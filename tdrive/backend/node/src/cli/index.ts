import "reflect-metadata";
import yargs from "yargs";
import { logger } from "../core/platform/framework/logger";
import printConfigSummary from "./lib/print-config-summary";
import version from "../version";

process.env.NODE_ENV = "cli";

yargs
  .strict()
  .usage("Usage: $0 <command> [options]")
  .middleware([
    argv => {
      logger.level = argv.verbose ? "debug" : "error";
      if (!argv.quietConfigSummary) {
        console.error("Platform configuration:");
        printConfigSummary().forEach(x => console.error(`\t${x}`));
      }
    },
  ])
  .commandDir("cmds", {
    visit: commandModule => commandModule.default,
  })
  .option("verbose", {
    alias: "v",
    default: false,
    type: "boolean",
    description: "Run with verbose logging",
    group: "Output",
  })
  .option("quietConfigSummary", {
    alias: "q",
    default: false,
    type: "boolean",
    description: "Do not print the configuration summary at startup",
    group: "Output",
  })
  .demandCommand(1, "Please supply a valid command")
  .alias("help", "h")
  .help("help")
  .version(version.current)
  .completion("completion")
  .epilogue("for more information, go to https://tdrive.app")
  .example("$0 <command> --help", "show help of the issue command").argv;
