import { CommandModule } from "yargs";

const command: CommandModule = {
  describe: "Editing sessions tools",
  command: "editing_session",
  builder: yargs =>
    yargs.commandDir("editing_session_cmds", {
      visit: commandModule => commandModule.default,
    }),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  handler: () => {
    throw new Error("Missing sub-command");
  },
};

export default command;
