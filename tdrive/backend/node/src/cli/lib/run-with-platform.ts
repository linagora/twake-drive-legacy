import ora from "ora";

import config from "../../core/config";
import tdrive from "../../tdrive";
import gr from "../../services/global-resolver";
import type { TdrivePlatform } from "../../core/platform/platform";

//TODO: When this gets used for all commands; update verboseDuringRun from search/index-all and move to root index
//      And consider moving print-config-summary call here.

/**
 * Start the platform and its services, run the command (passed as
 * the `handler` callback), then cleanly shut down the platform.
 * @param prefix Prefix text to set on the Ora spinner
 * @param handler Callback to run the actual command. If it returns a number,
 *   that will be the exit code of the process.
 */
export default async function runWithPlatform(
  prefix: string,
  handler: (args: {
    spinner: ora.Ora;
    config: config.IConfig;
    platform: TdrivePlatform;
  }) => Promise<number | undefined> | Promise<void>,
) {
  const spinner = ora({ prefixText: prefix + " >" });
  spinner.start("Platform: starting...");
  const platform = await tdrive.run(config.get("services"));
  await gr.doInit(platform);
  spinner.succeed("Platform: started");
  try {
    const exitCode = await handler({ spinner, config, platform });
    if (typeof exitCode === "number") process.exitCode = exitCode;
  } catch (err) {
    spinner.fail(err.stack || err);
    process.exitCode = 1;
  }
  // Spinner seems to interrupt still buffered output otherwise
  await new Promise(resolve => setTimeout(resolve, 200));
  spinner.start("Platform: shutting down...");
  await platform.stop();
  spinner.succeed("Platform: shutdown");
  spinner.stop();
}
