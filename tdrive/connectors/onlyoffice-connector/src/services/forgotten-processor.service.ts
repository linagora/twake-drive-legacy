import logger from '@/lib/logger';
import { onlyOfficeForgottenFilesCheckPeriodMS } from '@/config';
import { PolledThingieValue } from '@/lib/polled-thingie-value';
import { createSingleProcessorLock } from '@/lib/single-processor-lock';

import apiService from './api.service';
import onlyofficeService from './onlyoffice.service';
import driveService, { UnknownKeyInDriveError } from './drive.service';
import { IHealthProvider, registerHealthProvider } from './health-providers.service';

/**
 * Periodically poll the Only Office document server for forgotten
 * files and try to upload to Twake Drive or get rid if unknown.
 */
class ForgottenProcessor implements IHealthProvider {
  private readonly forgottenFilesPoller: PolledThingieValue<number>;
  public readonly forgottenSynchroniser = createSingleProcessorLock<boolean>();
  private lastStart = 0;

  constructor() {
    let skippedFirst = false;
    this.forgottenFilesPoller = new PolledThingieValue(
      'Process forgotten files in OO',
      async () => (skippedFirst ? await this.processForgottenFiles() : ((skippedFirst = true), -1)),
      onlyOfficeForgottenFilesCheckPeriodMS,
    );
    registerHealthProvider(this);
  }

  public async getHealthData() {
    try {
      const keys = await onlyofficeService.getForgottenList();
      return {
        forgotten: {
          timeSinceLastStartS: this.lastStart ? ~~((new Date().getTime() - this.lastStart) / 1000) : -1,
          count: keys?.length ?? 0,
          locks: this.forgottenSynchroniser.getWorstStats(),
        },
      };
    } catch (e) {
      return { forgotten: 'Error' };
    }
  }

  /**
   * The point of this is to ensure this file is imported,
   * which is needed for side-effect of starting this timer.
   * The only other use being the health stuff it could easily
   * be refactored out as unused.
   */
  public makeSureItsLoaded() {
    return 'yup this module is loaded !';
  }

  /**
   * Try to upload the forgotten file, optionally delete it from OO, will return if it was
   * (or should be) deleted. Does not throw unless the OO deletion itself threw.
   */
  private async safeEndEditing(key: string, url: string, deleteForgotten: boolean) {
    return this.forgottenSynchroniser.runWithLock(key, async () => {
      let succeded = false;
      try {
        await driveService.endEditing(key, url);
        succeded = true;
      } catch (error) {
        if (!(error instanceof UnknownKeyInDriveError))
          logger.error(`Error processing forgotten file by key ${JSON.stringify(key)}: ${error}`, { key, url, error });
        // Can't do much about it here, hope it goes in retry, but don't
        // throw to keep processing
        //TODO: Maybe make a date string, compare to key, if old enough, delete...
        // this logic should probably in Twake Drive backend though
      }
      if (succeded && deleteForgotten) await onlyofficeService.deleteForgotten(key);
      return succeded;
    });
  }

  private async processForgottenFiles() {
    this.lastStart = new Date().getTime();
    if (!(await apiService.hasToken())) return -1;
    return await onlyofficeService.processForgotten((key, url) =>
      this.safeEndEditing(key, url, false /* `onlyofficeService.processForgotten` will do it */),
    );
  }

  /**
   * Attempt to upload the forgotten OO file, only throws if deleting it failed,
   * returns wether it was deleted.
   */
  public async processForgottenFile(key: string, url: string) {
    return this.safeEndEditing(key, url, true);
  }
}

export default new ForgottenProcessor();
