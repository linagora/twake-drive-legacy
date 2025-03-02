import yargs from "yargs";

import runWithPlatform from "../../lib/run-with-platform";
import { messageQueueLogger, platformLogger } from "../../../core/platform/framework";
import { buildUserDeletionRepositories } from "../../../core/platform/services/admin/utils";
import type User from "../../../services/user/entities/user";
import { EntityByKind } from "../../utils/print-entities";

let globalArgv: {
  verbose: boolean;

  emailLike: string;
  jsonOutput: boolean;

  user?: User; // Not an argument per say, hydrated in handler
};

const entityToHeaderString = <K extends keyof typeof EntityByKind>(
  kind: K & string,
  entity: Parameters<(typeof EntityByKind)[K]["headerOf"]>[0],
): string => {
  if (globalArgv.jsonOutput) return kind + " " + JSON.stringify(entity); // Can't really print out json directly, valid json seems to get prettified by pino
  // ts doesn't seem to infer entityHeaderPrinter[kind] correctly even with help
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  return `${entity.id} ${EntityByKind[kind].headerOf(entity as any)}`;
};

export default {
  command: "list",
  describe: "list users",
  builder: {
    emailLike: {
      alias: "e",
      type: "string",
      describe:
        "id of the user, or a search string for the email.\n(if the id doesn't match, will print the matching users and exit)",
    },
    jsonOutput: {
      type: "boolean",
      alias: "j",
      describe: "Output in lines of '[kind] [json_object]'.",
    },
  },
  handler: async (argv: typeof globalArgv) => {
    globalArgv = argv;
    if (!argv.verbose) {
      platformLogger.level = "warn";
      messageQueueLogger.level = "warn";
    }
    await runWithPlatform("dump_account", async ({ spinner: _spinner, platform: _platform }) => {
      const repos = await buildUserDeletionRepositories();
      console.log(
        (
          await repos.user.find(
            {},
            {
              ...(argv.emailLike ? { $like: [["email_canonical", argv.emailLike]] } : {}),
              sort: { email_canonical: "asc" },
            },
          )
        )
          .getEntities()
          .map(user => entityToHeaderString("user", user))
          .join("\n"),
      );
      return 0;
    });
  },
} as yargs.CommandModule<object, typeof globalArgv>;
