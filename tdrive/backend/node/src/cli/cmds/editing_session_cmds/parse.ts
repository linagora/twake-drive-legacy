import yargs from "yargs";

import { NonPlatformCommandYargsBuilder } from "../../utils/non-plaform-command-yargs-builder";
import { EditingSessionKeyFormat } from "../../../services/documents/entities/drive-file";

interface ParseArguments {
  editing_session_key: string;
}

const command: yargs.CommandModule<unknown, unknown> = {
  command: "parse <editing_session_key>",
  describe: `
    Parse the provided editing_session_key and output json data (to stderr)
  `.trim(),

  builder: {
    ...NonPlatformCommandYargsBuilder,
  },
  handler: async argv => {
    const args = argv as unknown as ParseArguments;
    const parsed = EditingSessionKeyFormat.parse(decodeURIComponent("" + args.editing_session_key));
    console.error(
      JSON.stringify(
        {
          ageH: (new Date().getTime() - parsed.timestamp.getTime()) / (60 * 60 * 1000),
          ...parsed,
        },
        null,
        2,
      ),
    );
  },
};
export default command;
