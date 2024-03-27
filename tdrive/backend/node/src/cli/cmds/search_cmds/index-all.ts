import yargs from "yargs";

import type { TdrivePlatform } from "../../../core/platform/platform";
import runWithPlatform from "../../lib/run_with_platform";
import parseYargsCommaSeparatedStringArray from "../../utils/yargs-comma-array";
import runWithLoggerLevel from "../../utils/run-with-logger-level";

import type BaseReindexer from "./index-all/base-reindexer";
import type ReindexerOptions from "./index-all/reindexer-options";

/** Serves as an index of classes for the repos to reindex; to specialise bits of behaviour and what not */
const RepositoryNameToCTOR = new Map<
  string,
  {
    ctor: (platform: TdrivePlatform, options: ReindexerOptions) => BaseReindexer<any>;
    repairDescription: string;
  }
>();

import UsersReindexer from "./index-all/users-reindexer";
RepositoryNameToCTOR.set("users", {
  ctor: (platform, options) => new UsersReindexer(platform, options),
  repairDescription: UsersReindexer.repairActionDescription,
});

import DocumentsReindexer from "./index-all/documents-reindexer";
RepositoryNameToCTOR.set("documents", {
  ctor: (platform, options) => new DocumentsReindexer(platform, options),
  repairDescription: DocumentsReindexer.repairActionDescription,
});

const reindexingArgumentGroupTitle = "Re-indexing options";
const command: yargs.CommandModule<unknown, unknown> = {
  command: "index",
  describe: "command to reindex search middleware from db entities",
  builder: {
    repository: {
      type: "string",
      description: "Repository to re-index.",
      choices: [...RepositoryNameToCTOR.keys()],
      demandOption: true,
      group: reindexingArgumentGroupTitle,
    },
    repairEntities: {
      default: false,
      type: "boolean",
      description: [
        "Repair entities too when possible",
        ...[...RepositoryNameToCTOR.keys()]
          .sort()
          .map(name => `${name}: ${RepositoryNameToCTOR.get(name).repairDescription}`),
      ].join("\n- "),
      group: reindexingArgumentGroupTitle,
    },
    filterDocumentsByUserEMail: {
      type: "string",
      alias: "e",
      description:
        "When processing documents, limit to those owned by the users with the provided comma separated e-mails",
      group: "Filtering for documents repository",
    },
    verboseDuringRun: {
      type: "boolean",
      alias: "V",
      description:
        "Set to verbose logging except for startup and shutdown of Platform. Use flag once for 'info' level, twice for 'debug'.",
      group: "Output",
      count: true,
    },
  },
  handler: async argv => {
    const repositories = parseYargsCommaSeparatedStringArray(
      argv.repository as string /* ignore typechecker */,
    );
    const filterDocumentsByUserEMail = parseYargsCommaSeparatedStringArray(
      argv.filterDocumentsByUserEMail as string /* ignore typechecker */,
    );
    await runWithPlatform("Re-index", async ({ spinner, platform }) => {
      return await runWithLoggerLevel(
        argv.verboseDuringRun
          ? (argv.verboseDuringRun as number) > 1
            ? "debug"
            : "info"
          : undefined,
        async () => {
          try {
            for (const repositoryName of repositories)
              await RepositoryNameToCTOR.get(repositoryName)
                .ctor(platform, {
                  spinner,
                  repairEntities: !!argv.repairEntities,
                  filterDocumentsByUserEMail,
                })
                .run();
          } catch (err) {
            spinner.fail(err.stack || err);
            return 1;
          }
        },
      );
    });
  },
};

export default command;
