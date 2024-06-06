import { FileTreeObject } from '@components/uploads/file-tree-utils';
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
  const { create, refresh } = useDriveActions();

  const logger = Logger.getLogger('useDriveUpload')

  const uploadVersion = async (file: File, context: { companyId: string; id: string }) => {
    return new Promise(r => {
      FileUploadService.upload([file], {
        context: {
          companyId: context.companyId,
          id: context.id,
        },
        callback: async (file, context) => {
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
    // Create all directories
    logger.debug("Start creating directories ...");
    const filesPerParentId = await FileUploadService.createDirectories(tree.tree, context);
    await refresh(context.parentId, true);
    logger.debug("All directories created");

    // Upload files into directories
    logger.debug("Start file uploading")
    for (const parentId of Object.keys(filesPerParentId)) {
      logger.debug(`Upload files for directory ${parentId}`);
      await FileUploadService.upload(filesPerParentId[parentId], {
        context: {
          companyId: context.companyId,
          parentId: parentId,
        },
        callback: (file, context) => {
          logger.debug('created file: ', file);
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
    }
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
        const file = new File([request.response], name);
        FileUploadService.upload([file], {
          context: {
            companyId: context.companyId,
            parentId: context.parentId,
          },
          callback: (file, context) => {
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
        ToasterService.error('Error while creating an empty file.');
      }
    };
    request.send();
  };

  return { uploadTree, uploadFromUrl, uploadVersion };
};
