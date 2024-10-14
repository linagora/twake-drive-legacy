import yargs from "yargs";

import parseYargsCommaSeparatedStringArray from "../../utils/yargs-comma-array";
import { NonPlatformCommandYargsBuilder } from "../../utils/non-plaform-command-yargs-builder";
import { openWithSystemViewer } from "../../../utils/exec";

const CORE_LANGUAGES = "en fr ru vi".split(" ");

const TEMPLATE_VAR_NAME = "TDCLI_TRANSLATOR_URL";
const urlToTranslate = (text: string, to: string, from?: string) => {
  const template = process.env[TEMPLATE_VAR_NAME];
  if (!template) throw new Error(`${TEMPLATE_VAR_NAME} environment variable must be set.`);
  const variables = {
    to,
    from,
    text,
  };
  return template.replace(/%\{([^}:]+)(?::([^}]+))?\}/g, (_, varName, absentValue) => {
    if (!(varName in variables))
      throw new Error(`Invalid variable ${JSON.stringify(varName)} in ${TEMPLATE_VAR_NAME}`);
    const replacement = variables[varName] ? variables[varName] : absentValue;
    if (!replacement?.length && !absentValue?.length)
      throw new Error(`No value for variable ${JSON.stringify(varName)} in ${TEMPLATE_VAR_NAME}`);
    return encodeURIComponent(replacement);
  });
};

interface TranslateArguments {
  text: string;
  to: string[];
  from?: string;
}

const LanguageGroup = "Languages";

const command: yargs.CommandModule<unknown, unknown> = {
  command: "translate <text>",
  describe: `
    Open translations for the provided english string.
    Note: Do not call with unknown values as this will be injected in a command line.\n
    Set ${TEMPLATE_VAR_NAME} to a translation service URL with url encoded:
    - %{from:auto} and %{to} to be replaced by languages from arguments. If from is not set, use the value after ':'." +
    - %{text} to be replaced by the text to translate
  `.trim(),
  builder: {
    ...NonPlatformCommandYargsBuilder,
    to: {
      type: "string",
      array: true,
      description: "Comma separated destination languages",
      choices: CORE_LANGUAGES,
      default: CORE_LANGUAGES.filter(x => x != "en"),
      group: LanguageGroup,
    },
    from: {
      type: "string",
      description: "Language of the text to translate",
      group: LanguageGroup,
    },
  },
  handler: async argv => {
    try {
      const args = argv as unknown as TranslateArguments;
      const to = parseYargsCommaSeparatedStringArray(args.to);
      for (const lang of to) await openWithSystemViewer(urlToTranslate(args.text, lang, args.from));
    } catch (e) {
      console.error(e.stack || e);
      process.exit(1);
    }
  },
};
export default command;
