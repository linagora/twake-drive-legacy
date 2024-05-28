import { CommandModule } from "yargs";

const command: CommandModule = {
  describe: "Manage db migrations",
  command: "db <command>",
  builder: yargs =>
    yargs.commandDir("db_cmds", {
      visit: commandModule => commandModule.default,
    }),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  handler: () => {},
};

export default command;
