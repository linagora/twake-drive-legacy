import yargs from "yargs";

import runWithPlatform from "../../lib/run-with-platform";
import gr from "../../../services/global-resolver";
import { messageQueueLogger, platformLogger } from "../../../core/platform/framework";
import {
  buildUserDeletionRepositories,
  descendDriveItemsDepthFirstRandomOrder,
  loadRawVersionsOfItemForDeletion,
  type TUserDeletionRepos,
} from "../../../core/platform/services/admin/utils";
import type User from "../../../services/user/entities/user";
import { EntityByKind } from "../../utils/print-entities";

let globalArgv: {
  verbose: boolean;

  userId: string;
  jsonOutput: boolean;
  withStoragePaths: boolean;

  user?: User; // Not an argument per say, hydrated in handler
};

const lengthOfLongestEntityKind = Object.keys(EntityByKind).reduce(
  (acc, kind) => Math.max(acc, kind.length),
  0,
);

const entityToHeaderString = <K extends keyof typeof EntityByKind>(
  kind: K & string,
  entity: Parameters<(typeof EntityByKind)[K]["headerOf"]>[0],
  depth: number = 0,
): string => {
  if (globalArgv.jsonOutput) return kind + " " + JSON.stringify(entity); // Can't really print out json directly, valid json seems to get prettified by pino
  // ts doesn't seem to infer entityHeaderPrinter[kind] correctly even with help
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  return `${kind.padEnd(lengthOfLongestEntityKind)} ${entity.id} ${new Array(depth + 1).join(
    "    ",
  )}${EntityByKind[kind].headerOf(entity as any)}`;
};

async function dumpAccount(repos: TUserDeletionRepos): Promise<number> {
  console.log(entityToHeaderString("user", globalArgv.user));
  await descendDriveItemsDepthFirstRandomOrder(
    repos,
    "user_" + globalArgv.user.id,
    async (item, _children, parents) => {
      const depth = parents.length + 1;
      if (!item.is_directory) {
        const versionsAssets = await loadRawVersionsOfItemForDeletion(
          repos,
          item,
          globalArgv.withStoragePaths,
        );
        for (const { version, file, paths } of versionsAssets) {
          const outputPath = (path: string) =>
            console.log(entityToHeaderString("s3", { id: file.id, path }, depth + 2));
          if (globalArgv.jsonOutput) {
            for (const path of paths || []) outputPath(path);
          } else if (paths) {
            paths.sort((a, b) => a.localeCompare(b));
            if (paths.length > 0) outputPath(paths[0]);
            if (paths.length == 3) outputPath(paths[1]);
            else if (paths.length > 3) outputPath(`... skipping ${paths.length - 2} paths ...`);
            if (paths.length > 1) outputPath(paths[paths.length - 1]);
          }
          file && console.log(entityToHeaderString("file", file, depth + 2));
          version && console.log(entityToHeaderString("version", version, depth + 1));
        }
      }
      console.log(entityToHeaderString("item", item, depth));
    },
  );
  return 0;
}

export default {
  command: "dump <userId>",
  describe: "Output a list of entities related to a user",
  builder: {
    userId: {
      demandOption: true,
      type: "string",
      describe:
        "id of the user, or a search string for the email.\n(if the id doesn't match, will print the matching users and exit)",
    },
    jsonOutput: {
      type: "boolean",
      alias: "j",
      describe: "Output in lines of '[kind] [json_object]'.",
    },
    withStoragePaths: {
      type: "boolean",
      alias: "p",
      describe: "If set, also query the storage to include all relevant paths in the output",
    },
  },
  handler: async (argv: typeof globalArgv) => {
    globalArgv = argv;
    if (!argv.verbose) {
      platformLogger.level = "warn";
      messageQueueLogger.level = "warn";
    }
    await runWithPlatform("dump_account", async ({ spinner: _spinner, platform: _platform }) => {
      const repos = await buildUserDeletionRepositories(gr.database, gr.platformServices.search);
      argv.user = await repos.user.findOne({ id: argv.userId });
      if (!argv.user) {
        console.error(`Error, unknown user ${JSON.stringify(argv.userId)}`);
        return 1;
      }
      await dumpAccount(repos);
      return 0;
    });
  },
} as yargs.CommandModule<object, typeof globalArgv>;
