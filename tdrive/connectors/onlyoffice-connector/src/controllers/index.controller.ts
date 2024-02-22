import editorService from '@/services/editor.service';
import { NextFunction, Request, Response } from 'express';
import { CREDENTIALS_SECRET, SERVER_ORIGIN, SERVER_PREFIX } from '@config';
import jwt from 'jsonwebtoken';
import driveService from '@/services/drive.service';
import { DriveFileType } from '@/interfaces/drive.interface';
import fileService from '@/services/file.service';
import { OfficeToken } from '@/interfaces/routes.interface';
import loggerService from '@/services/logger.service';

interface RequestQuery {
  mode: string;
  company_id: string;
  preview: string;
  token: string;
  file_id: string;
  drive_file_id?: string;
}

interface RequestEditorQuery {
  office_token: string;
  company_id: string;
  file_id: string;
}

class IndexController {
  public index = async (req: Request<{}, {}, {}, RequestQuery>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { file_id, drive_file_id, company_id, preview, token } = req.query;
      const { user } = req;

      let driveFile: DriveFileType;
      if (drive_file_id) {
        //Append information about the drive file (versions, location, etc)
        driveFile = await driveService.get({
          drive_file_id,
          company_id,
          user_token: token,
        });

        if (!driveFile) {
          throw new Error('Drive file not found');
        }
      }

      //Get the file itself
      const file = await fileService.get({
        file_id: driveFile?.item?.last_version_cache?.file_metadata?.external_id || file_id,
        company_id,
      });

      if (!file) {
        throw new Error('File not found');
      }

      //Check whether the user has access to the file and put information to the office_token
      const hasAccess =
        (!driveFile && (file.user_id === user.id || preview)) ||
        ['manage', 'write'].includes(driveFile?.access) ||
        (driveFile?.access === 'read' && preview);

      if (!hasAccess) {
        throw new Error('You do not have access to this file');
      }

      const officeToken = jwt.sign(
        {
          user_id: user.id, //To verify that link is opened by the same user
          company_id,
          drive_file_id,
          file_id: file.id,
          file_name: file.filename || file?.metadata?.name || '',
          preview: !!preview,
        } as OfficeToken,
        CREDENTIALS_SECRET,
        {
          expiresIn: 60 * 60 * 24 * 30,
        },
      );

      res.redirect(
        `${SERVER_ORIGIN ?? ''}/${SERVER_PREFIX.replace(
          /(\/+$|^\/+)/gm,
          '',
        )}/editor?office_token=${officeToken}&token=${token}&file_id=${file_id}&company_id=${company_id}&preview=${preview}`,
      );
    } catch (error) {
      next(error);
    }
  };

  public editor = async (req: Request<{}, {}, {}, RequestEditorQuery>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { office_token } = req.query;
      const { user } = req;

      const officeTokenPayload = jwt.verify(office_token, CREDENTIALS_SECRET) as OfficeToken;
      const { preview, user_id, company_id, file_name, file_id, drive_file_id } = officeTokenPayload;

      if (user_id !== user.id) {
        throw new Error('You do not have access to this link');
      }

      const initResponse = await editorService.init(company_id, file_name, file_id, user, preview, drive_file_id || file_id);

      const inPageToken = jwt.sign(
        {
          ...officeTokenPayload,
          in_page_token: true,
        } as OfficeToken,
        CREDENTIALS_SECRET,
      );

      res.render('index', {
        ...initResponse,
        server: SERVER_ORIGIN.replace(/\/+$/, '') + '/' + SERVER_PREFIX.replace(/(\/+$|^\/+)/, '') || `${req.protocol}://${req.get('host')}/`,
        token: inPageToken,
      });
    } catch (error) {
      loggerService.error(error);
      next(error);
    }
  };
}

export default IndexController;
