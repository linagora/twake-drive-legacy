import { CREDENTIALS_SECRET } from '@/config';
import { OfficeToken } from '@/interfaces/routes.interface';
import driveService from '@/services/drive.service';
import fileService from '@/services/file.service';
import logger from '@/lib/logger';
import * as OnlyOffice from '@/services/onlyoffice.service';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface RequestQuery {
  company_id: string;
  file_id: string;
  token: string;
}

/** These expose a OnlyOffice document storage service methods, called by the OnlyOffice document editing service
 * to load and save files
 */
class OnlyOfficeController {
  /**
   * Get a file from Twake Drive backend, and proxy it back the previewer/editor (via the document editing service).
   *
   * Parameters are standard Express middleware.
   * @see https://api.onlyoffice.com/editors/open
   */
  public read = async (req: Request<{}, {}, {}, RequestQuery>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.query;

      const officeTokenPayload = jwt.verify(token, CREDENTIALS_SECRET) as OfficeToken;
      const { company_id, drive_file_id, file_id, in_page_token } = officeTokenPayload;
      let fileId = file_id;

      // check token is an in_page_token
      if (!in_page_token) throw new Error('Invalid token, must be a in_page_token');

      if (drive_file_id) {
        //Get the drive file
        const driveFile = await driveService.get({
          company_id,
          drive_file_id,
        });
        if (driveFile) {
          fileId = driveFile?.item?.last_version_cache?.file_metadata?.external_id;
        }
      }

      const file = await fileService.download({
        company_id,
        file_id: fileId,
      });

      file.pipe(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Receive a file from OnlyOffice document editing service and save it into Twake Drive backend.
   *
   * This is the endpoint of the callback url provided to the editor in the browser.
   *
   * Parameters are standard Express middleware.
   * @see https://api.onlyoffice.com/editors/save
   * @see https://api.onlyoffice.com/editors/callback
   */
  public ooCallback = async (
    req: Request<{}, {}, OnlyOffice.Callback.Parameters, RequestQuery>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const respondToOO = (error = 0) => void res.send({ error });
    try {
      const { url, key } = req.body;
      const { token } = req.query;
      logger.info('Save request', { key, url, token });

      const officeTokenPayload = jwt.verify(token, CREDENTIALS_SECRET) as OfficeToken;
      const { preview, company_id, file_id, /* user_id, */ drive_file_id, in_page_token } = officeTokenPayload;

      // check token is an in_page_token and allow save
      if (!in_page_token) throw new Error('Invalid token, must be a in_page_token');
      if (preview) throw new Error('Invalid token, must not be a preview token for save operation');

      switch (req.body.status) {
        case OnlyOffice.Callback.Status.BEING_EDITED:
        case OnlyOffice.Callback.Status.BEING_EDITED_BUT_IS_SAVED:
          // No-op
          break;

        case OnlyOffice.Callback.Status.READY_FOR_SAVING:
          const newVersionFile = await fileService.save({
            company_id,
            file_id,
            url,
            create_new: true,
          });

          const version = await driveService.createVersion({
            company_id,
            drive_file_id,
            file_id: newVersionFile?.resource?.id,
          });
          logger.info('New version created', version);
          return respondToOO();

        case OnlyOffice.Callback.Status.CLOSED_WITHOUT_CHANGES:
          // Save end of transaction
          break;

        case OnlyOffice.Callback.Status.ERROR_SAVING:
          // Save end of transaction
          logger.info(`Error saving file ${req.body.url} (key: ${req.body.key})`);
          break;

        case OnlyOffice.Callback.Status.ERROR_FORCE_SAVING:
          // TODO: notify user ?
          logger.info(`Error force saving (reason: ${req.body.forcesavetype}) file ${req.body.url} (key: ${req.body.key})`);
          return void res.send({ error: 0 });

        default:
          throw new Error(`Unexpected OO Callback status field: ${req.body.status}`);
      }
      return respondToOO();
    } catch (error) {
      next(error);
    }
  };
}

export default OnlyOfficeController;
