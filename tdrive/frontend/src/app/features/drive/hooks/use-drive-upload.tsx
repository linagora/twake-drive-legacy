import { FileTreeObject } from '@components/uploads/file-tree-utils';
import FileUploadService from '@features/files/services/file-upload-service';
import { ToasterService } from '@features/global/services/toaster-service';
import { DriveApiClient } from '../api-client/api-client';
import { useDriveActions } from './use-drive-actions';

/**
 * Returns the children of a drive item
 * @param id
 * @returns
 */
export const useDriveUpload = () => {
  const { create } = useDriveActions();

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
    const filesPerParentId: { [key: string]: File[] } = {};

    // Create all directories
    console.debug("Start creating directories ...");
    const createDirectories = async (tree: FileTreeObject['tree'], parentId: string) => {
      for (const directory of Object.keys(tree)) {
        if (tree[directory] instanceof File) {
          if (!filesPerParentId[parentId]) filesPerParentId[parentId] = [];
          filesPerParentId[parentId].push(tree[directory] as File);
        } else {
          console.debug(`Create directory ${directory}`);
          const driveItem = await create(
            {
              company_id: context.companyId,
              parent_id: parentId,
              name: directory,
              is_directory: true,
            },
            {},
          );
          console.debug(`Directory ${directory} created`);
          if (driveItem?.id) {
            await createDirectories(tree[directory] as FileTreeObject['tree'], driveItem.id);
          } else {
            throw new Error('Could not create directory');
          }
        }
      }
    };
    await createDirectories(tree.tree, context.parentId);
    console.debug("All directories created");

    // Upload files into directories
    for (const parentId of Object.keys(filesPerParentId)) {
      await FileUploadService.upload(filesPerParentId[parentId], {
        context: {
          companyId: context.companyId,
          parentId: parentId,
        },
        callback: (file, context) => {
          console.log('created file: ', file);
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
