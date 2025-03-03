import { FileTreeObject, getFileIdsInTree } from '@components/uploads/file-tree-utils';
import FileUploadService from '@features/files/services/file-upload-service';
import { ToasterService } from '@features/global/services/toaster-service';
import { DriveApiClient } from '../api-client/api-client';
import { useDriveActions } from './use-drive-actions';
import Logger from '@features/global/framework/logger-service';

/**
 * Returns the children of a drive item
 * @returns
 */
export const useDriveUpload = () => {
  const { create, refresh, restore } = useDriveActions();

  const logger = Logger.getLogger('useDriveUpload');

  const uploadVersion = async (file: File, context: { companyId: string; id: string }) => {
    return new Promise(r => {
      FileUploadService.resetStates([file.name]);
      FileUploadService.upload([{ root: file.name, file }], {
        context: {
          companyId: context.companyId,
          id: context.id,
        },
        callback: async (filePayload, context) => {
          const file = filePayload.file;
          if (file) {
            const version = {
              drive_item_id: context.id,
              provider: 'internal',
              file_metadata: {
                name: file.metadata?.name,
                size: file.upload_data?.size,
                mime: file.metadata?.mime,
                thumbnails: file?.thumbnails,
                source: 'internal',
                external_id: file.id,
              },
            };
            await DriveApiClient.createVersion(context.companyId, context.id, version);
          }
          r(true);
        },
      });
    });
  };

  const uploadTree = async (
    tree: FileTreeObject,
    context: { companyId: string; parentId: string },
  ) => {
    logger.debug('Start creating directories and file upload ...');
    FileUploadService.resetStates(getFileIdsInTree(tree.tree));
    await FileUploadService.createDirectories(tree, context);
    await refresh(context.parentId, true);
  };

  const uploadFromUrl = (
    url: string,
    name: string,
    context: { companyId: string; parentId: string },
  ) => {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'blob';
    request.onload = function () {
      try {
        if (request.status != 200)
          throw new Error(
            `Unexpected response status code: ${request.status} from ${JSON.stringify(url)}`,
          );
        const file = new File([request.response], name);
        FileUploadService.resetStates([file.name]);
        FileUploadService.upload([{ root: file.name, file }], {
          context: {
            companyId: context.companyId,
            parentId: context.parentId,
          },
          callback: (filePayload, context) => {
            const file = filePayload.file;
            if (file) {
              create(
                {
                  company_id: context.companyId,
                  workspace_id: 'drive', //We don't set workspace ID for now
                  parent_id: context.parentId,
                  name: file.metadata?.name,
                  size: file.upload_data?.size,
                },
                {
                  provider: 'internal',
                  application_id: '',
                  file_metadata: {
                    name: file.metadata?.name,
                    size: file.upload_data?.size,
                    mime: file.metadata?.mime,
                    thumbnails: file?.thumbnails,
                    source: 'internal',
                    external_id: file.id,
                  },
                },
              );
            }
          },
        });
      } catch (e) {
        logger.error(`Error creating file`, e);
        ToasterService.error('Error while creating a new file from template.');
      }
    };
    request.send();
  };

  return { uploadTree, uploadFromUrl, uploadVersion };
};
