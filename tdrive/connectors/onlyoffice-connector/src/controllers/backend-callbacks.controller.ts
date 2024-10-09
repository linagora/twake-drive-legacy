import { Request, Response } from 'express';
import logger from '@/lib/logger';
import { createSingleProcessorLock } from '@/lib/single-processor-lock';
import onlyofficeService, { Callback, CommandError, ErrorCode } from '@/services/onlyoffice.service';
import driveService from '@/services/drive.service';
import forgottenProcessorService from '@/services/forgotten-processor.service';
import { registerHealthProvider } from '@/services/health-providers.service';

interface RequestQuery {
  editing_session_key: string;
}
interface RenameRequestBody {
  title: string;
}
const keyCheckLock = createSingleProcessorLock<[status: number, body: unknown]>();

registerHealthProvider({
  async getHealthData() {
    return { checks: { locks: keyCheckLock.getWorstStats() } };
  },
});

/**
 * These routes are called by Twake Drive backend, for ex. before editing or retreiving a file,
 * if it has an editing_session_key still, get the status of that and force a resolution.
 */
export default class TwakeDriveBackendCallbackController {
  /**
   * Get status of an `editing_session_key` from OO, and return a URL to get the latest version,
   * or an object with no `url` property, in which case the key is not known as forgotten by OO and should
   * be considered lost after an admin alert.
   *
   * @returns
   *   - `{ status: 'unknown' }`: the key isn't known and maybe used for a new session
   *   - `{ status: 'updated' }`: the key needed updating but is now invalid
   *   - `{ status: 'expired' }`: the key was already used in a finished session and can't be used again
   *   - `{ status: 'live' }`:    the key is valid and current and should be used again for the same file
   *   - `{ error: number }`:     there was an error retreiving the status of the key, http status `!= 200`
   */
  public async checkSessionStatus(req: Request<RequestQuery>, res: Response): Promise<void> {
    const [status, body] = await keyCheckLock.runWithLock(req.params.editing_session_key, async () => {
      try {
        const forgottenURL = await onlyofficeService.getForgotten(req.params.editing_session_key);
        try {
          await forgottenProcessorService.processForgottenFile(req.params.editing_session_key, forgottenURL);
        } catch (error) {
          logger.error(`processForgottenFile failed`, { error });
          return [502, { error: -57650 }];
        }
        return [200, { status: 'updated' }];
      } catch (e) {
        if (!(e instanceof CommandError && e.errorCode == ErrorCode.KEY_MISSING_OR_DOC_NOT_FOUND)) {
          logger.error(`getForgotten failed`, { error: e });
          return [e instanceof CommandError ? 502 : 500, { error: -57651 }];
        }
      }
      const info = await onlyofficeService.getInfoAndWaitForCallbackUnsafe(req.params.editing_session_key);
      if (info.error === ErrorCode.KEY_MISSING_OR_DOC_NOT_FOUND) {
        // just start using it
        return [200, { status: 'unknown' }];
      }
      if (info.error !== undefined) {
        logger.error(`getInfo failed`, { error: info });
        return [502, { error: -57652 }];
      }
      switch (info.result.status) {
        case Callback.Status.BEING_EDITED:
        case Callback.Status.BEING_EDITED_BUT_IS_SAVED:
          // use it as is
          return [200, { status: 'live' }];

        case Callback.Status.CLOSED_WITHOUT_CHANGES:
          // just cancel it
          return [200, { status: 'expired' }];

        case Callback.Status.ERROR_FORCE_SAVING:
        case Callback.Status.ERROR_SAVING:
          return [502, { error: info.result.status }];

        case Callback.Status.READY_FOR_SAVING:
          // upload it, have to do it here for correct user stored in url in OO
          await driveService.endEditing(req.params.editing_session_key, info.result.url);
          return [200, { status: 'updated' }];

        default:
          throw new Error(`Unexpected callback status: ${JSON.stringify(info.result)}`);
      }
    });
    await res.status(status).send(body);
  }

  public async updateSessionFilename(req: Request<RequestQuery, {}, RenameRequestBody>, res: Response): Promise<void> {
    try {
      await onlyofficeService.meta(req.params.editing_session_key, req.body.title);
      res.send({ ok: 1 });
    } catch (err) {
      res.status(500).send({ error: -58650 });
    }
  }
}
