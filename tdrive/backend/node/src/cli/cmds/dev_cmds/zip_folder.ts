import yargs from "yargs";

import runWithPlatform from "../../lib/run-with-platform";
import gr from "../../../services/global-resolver";
import { messageQueueLogger, platformLogger } from "../../../core/platform/framework";
import User, { TYPE as UserTYPE } from "../../../services/user/entities/user";
import config from "config";
import globalResolver from "../../../services/global-resolver";
import fs from "fs";
import { CompanyExecutionContext, DriveItemDetails } from "../../../services/documents/types";
import { randomUUID } from "crypto";
import { getYesNo } from "cli-interact";

type ZipCommandArgs = {
  verbose: boolean;
  user: string;
  folder: string;
};

/**
 *
 */
export default {
  command: "zip",
  describe: "Zips specified folder and puts it to users root directory",
  builder: {
    user: {
      alias: "u",
      demandOption: true,
      type: "string",
      describe: "id or login or email of the user.",
    },
    folder: {
      alias: "f",
      demandOption: true,
      type: "string",
      describe: "folder identifier to zip",
    },
  },
  handler: async (argv: ZipCommandArgs) => {
    if (!argv.verbose) {
      platformLogger.level = "warn";
      messageQueueLogger.level = "warn";
    }
    await runWithPlatform("zip", async ({ spinner: _spinner, platform: _platform }) => {
      //create drive execution context for a specified user
      const context = await getContext(argv);
      //get folder to zip, and make all necessary checks
      const toZip = await gr.services.documents.documents.get(argv.folder, {}, context);
      //zip folder and pipe it to new file in storage
      const tmpFilePath = `/tmp/${argv.folder}-${randomUUID()}.zip`;
      await zipFolder(toZip, tmpFilePath, context);
      _spinner.info(`Folder successfully zipped to "${tmpFilePath}"`);
      //create a new document with this file in users root directory
      if (getYesNo("Do you want to upload file?")) {
        await saveFile(tmpFilePath, `${toZip.item.name}.zip`, context);
        _spinner.info(`"${toZip.item.name}.zip" saved to users home directory`);
        fs.rmSync(tmpFilePath);
        _spinner.info("Tmp files cleaned");
      }
      return 0;
    });
  },
} as yargs.CommandModule<object, ZipCommandArgs>;

async function saveFile(path: string, filename: string, context: CompanyExecutionContext) {
  const file = await gr.services.files.save(
    null,
    fs.createReadStream(path),
    {
      totalChunks: 1,
      totalSize: fs.statSync(path).size,
      chunkNumber: 1,
      filename: filename,
      type: "application/zip",
      waitForThumbnail: false,
      ignoreThumbnails: true,
    },
    context,
  );

  const driveItem = await gr.services.documents.documents.create(
    file,
    {
      name: filename,
      parent_id: `user_${context.user.id}`,
      is_directory: false,
    },
    {
      file_metadata: {
        source: "internal",
        external_id: file.id,
        name: filename,
        mime: "application/zip",
        size: file.upload_data.size,
      },
    },
    context,
  );
  console.log(driveItem);
}

async function getContext(argv: ZipCommandArgs): Promise<CompanyExecutionContext> {
  const user = await findUser(argv.user);
  if (!user) {
    throw new Error(`Error, unknown user ${JSON.stringify(argv.user)}`);
  }
  //create drive execution context for a specified user
  const company = config.get<string>("drive.defaultCompany");
  if (!company) {
    throw new Error(`Error, unknown company in configuration ${company}`);
  }
  return { user, company: { id: company } };
}

async function findUser(identifier: string): Promise<User | null> {
  const userRepo = await gr.database.getRepository<User>(UserTYPE, User);
  let user = await userRepo.findOne({ id: identifier });
  if (!user) user = await userRepo.findOne({ email_canonical: identifier });
  if (!user) user = await userRepo.findOne({ username_canonical: identifier });
  return user;
}

async function zipFolder(
  toZip: DriveItemDetails,
  outputPath: string,
  context: CompanyExecutionContext,
) {
  return new Promise<void>(async (resolve, reject) => {
    return await globalResolver.services.documents.documents.download(
      toZip.item.id,
      null,
      archive => {
        archive.pipe(fs.createWriteStream(outputPath));
        archive.on("finish", resolve);
        archive.on("error", reject);
      },
      context,
    );
  });
}
