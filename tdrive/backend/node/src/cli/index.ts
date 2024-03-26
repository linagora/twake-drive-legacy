import "reflect-metadata";
import yargs from "yargs";
import { logger } from "../core/platform/framework/logger";

process.env.NODE_ENV = "cli";

yargs
  .strict()
  .usage("Usage: $0 <command> [options]")
  .middleware([
    argv => {
      logger.level = argv.verbose ? "debug" : "fatal";
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
  })
  .demandCommand(1, "Please supply a valid command")
  .alias("help", "h")
  .help("help")
  .version()
  .completion("completion")
  .epilogue("for more information, go to https://tdrive.app")
  .example("$0 <command> --help", "show help of the issue command").argv;
