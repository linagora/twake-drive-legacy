/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import { v1 as uuid } from 'uuid';

import JWTStorage from '@features/auth/jwt-storage-service';
import { FileType, PendingFileType } from '@features/files/types/file';
import Resumable from '@features/files/utils/resumable';
import Logger from '@features/global/framework/logger-service';
import RouterServices from '@features/router/services/router-service';
import _ from 'lodash';
import FileUploadAPIClient from '../api/file-upload-api-client';
import { isPendingFileStatusPending } from '../utils/pending-files';
import { FileTreeObject } from 'components/uploads/file-tree-utils';
import { DriveApiClient } from 'features/drive/api-client/api-client';
import { ToasterService } from 'app/features/global/services/toaster-service';
import Languages from 'app/features/global/services/languages-service';
import { DriveItem, DriveItemVersion } from 'app/features/drive/types';

export enum Events {
  ON_CHANGE = 'notify',
}

export enum UploadStateEnum {
  Progress = 'progress',
  Completed = 'completed',
  Paused = 'paused',
  Cancelled = 'cancelled',
}

const logger = Logger.getLogger('Services/FileUploadService');
class FileUploadService {
  private pendingFiles: PendingFileType[] = [];
  private GroupedPendingFiles: { [key: string]: PendingFileType[] } = {};
  private RootSizes: { [key: string]: number } = {};
  private GroupIds: { [key: string]: string } = {};
  private pausedRoots: { [key: string]: boolean } = {};
  public currentTaskId = '';
  public parentId = '';
  public uploadStatus = UploadStateEnum.Progress;
  private recoilHandler: Function = () => undefined;
  private logger: Logger.Logger = Logger.getLogger('FileUploadService');

  setRecoilHandler(handler: Function) {
    this.recoilHandler = handler;
  }

  /**
   * Helper method to pause execution when `isPaused` is true.
   * @private
   */
  async _waitWhilePaused(id?: string) {
    while (this.uploadStatus === UploadStateEnum.Paused || (id && this.pausedRoots[id])) {
      if (this.uploadStatus === UploadStateEnum.Cancelled) return;
      await new Promise(resolve => setTimeout(resolve, 100)); // Check every 100ms
    }
  }

  /**
   * Helper method to cancel execution when `isCancelled` is true.
   * @private
   */
  private async checkCancellation() {
    if (this.uploadStatus === UploadStateEnum.Cancelled) {
      logger.warn('Operation cancelled.');
      throw new Error('Upload process cancelled.');
    }
  }

  notify() {
    const updatedState = Object.keys(this.GroupedPendingFiles).reduce((acc: any, key: string) => {
      // uploaded size
      const uploadedSize = this.GroupedPendingFiles[key]
        .map((f: PendingFileType) => {
          // if the file is successful and originalFile exists, add the size to the accumulator
          if (f.status === 'success' && f.originalFile?.size) {
            return f.originalFile.size;
          }
          return 0;
        })
        .reduce((acc: number, size: number) => acc + size, 0);
      // status can be "uploading", "completed", "paused" based on the size, uploadedSize and pausedRoots
      const status = this.pausedRoots[key]
        ? 'paused'
        : uploadedSize === this.RootSizes[key]
        ? 'completed'
        : 'uploading';
      // Add to the accumulator object
      acc[key] = {
        id: this.GroupIds[key],
        items: [],
        size: this.RootSizes[key],
        uploadedSize,
        status,
      };
      return acc;
    }, {});
    this.recoilHandler(_.cloneDeep(updatedState));
  }

  public async createDirectories(
    tree: FileTreeObject,
    context: { companyId: string; parentId: string },
  ) {
    const root = tree.tree;
    this.RootSizes = this.RootSizes = {
      ...this.RootSizes,
      ...(tree.sizePerRoot || {}),
    };
    // Create all directories
    const filesPerParentId: { [key: string]: { root: string; file: File }[] } = {};
    filesPerParentId[context.parentId] = [];
    const idsToBeRestored: string[] = [];

    const traverserTreeLevel = async (
      tree: FileTreeObject['tree'],
      parentId: string,
      tmp = false,
    ) => {
      // cancel upload
      if (this.uploadStatus === UploadStateEnum.Cancelled) return;

      // check if upload is paused
      await this._waitWhilePaused();

      // start descending the tree
      for (const directory of Object.keys(tree)) {
        const root = tree[directory].root as string;
        await this.checkCancellation();
        await this._waitWhilePaused(root);
        if (tree[directory].file instanceof File) {
          const file = tree[directory].file as File;
          console.log(`Adding file: ${file.name} under parentId: ${parentId}`);
          filesPerParentId[parentId].push({
            root: tree[directory].root as string,
            file,
          });
        } else {
          logger.debug(`Create directory ${directory}`);

          const item = {
            company_id: context.companyId,
            parent_id: parentId,
            name: directory,
            is_directory: true,
            is_in_trash: tmp,
          };

          if (!this.pendingFiles.some(f => isPendingFileStatusPending(f.status))) {
            //New upload task when all previous task is finished
            this.currentTaskId = uuid();
          }
          const pendingFile: PendingFileType = {
            id: uuid(),
            status: 'pending',
            progress: 0,
            lastProgress: new Date().getTime(),
            speed: 0,
            uploadTaskId: this.currentTaskId,
            originalFile: null,
            backendFile: null,
            resumable: null,
            label: directory,
            type: 'file',
            pausable: false,
          };

          try {
            const driveItem = await DriveApiClient.create(context.companyId, {
              item: item,
              version: {},
            });
            this.GroupIds[directory] = driveItem.id;
            this.logger.debug(`Directory ${directory} created`);
            pendingFile.status = 'success';
            this.notify();
            if (driveItem?.id) {
              filesPerParentId[driveItem.id] = [];
              if (tmp && !idsToBeRestored.includes(driveItem.id))
                idsToBeRestored.push(driveItem.id);
              await traverserTreeLevel(tree[directory] as FileTreeObject['tree'], driveItem.id);
            }
          } catch (e) {
            this.logger.error(e);
            throw new Error('Could not create directory');
          }
        }
      }
      // uploading the files goes here
      const files = _.cloneDeep(filesPerParentId[parentId]);
      // reset the filesPerParentId
      filesPerParentId[parentId] = [];
      await this.upload(files, {
        context: {
          companyId: context.companyId,
          parentId: parentId,
        },
        callback: async (file, context) => {
          if (file) {
            const item = {
              company_id: context.companyId,
              workspace_id: 'drive', //We don't set workspace ID for now
              parent_id: context.parentId,
              name: file.metadata?.name,
              size: file.upload_data?.size,
            } as Partial<DriveItem>;
            const version = {
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
            } as Partial<DriveItemVersion>;

            // create the document
            await DriveApiClient.create(context.companyId, { item, version });
          }
        },
      });
    };

    // split the tree per root
    const rootKeys = Object.keys(root);
    const rootTrees = rootKeys.map(key => {
      return { [key]: root[key] };
    });

    // tree promises
    const treePromises = rootTrees.map(tree => {
      return traverserTreeLevel(tree, context.parentId, true);
    });

    try {
      await Promise.all(treePromises);
    } catch (error) {
      if (this.uploadStatus !== UploadStateEnum.Cancelled) {
        console.error('An error occurred while processing treePromises:', error);
        // Optionally, handle the error or rethrow it
        throw error; // Re-throw the error if necessary
      } else {
        console.warn('Operation was cancelled. Error ignored.');
      }
    }

    // await traverserTreeLevel(root, context.parentId, true);

    return { filesPerParentId, idsToBeRestored };
  }

  public async upload(
    fileList: { root: string; file: File }[],
    options?: {
      context?: any;
      callback?: (file: FileType | null, context: any) => void;
    },
  ): Promise<PendingFileType[]> {
    const { companyId } = RouterServices.getStateFromRoute();

    if (!fileList || !companyId) {
      this.logger.log('FileList or companyId is undefined', [fileList, companyId]);
      return [];
    }

    if (!this.pendingFiles.some(f => isPendingFileStatusPending(f.status))) {
      //New upload task when all previous task is finished
      this.currentTaskId = uuid();
    }

    for (const file of fileList) {
      if (!file.file) continue;

      const pendingFile: PendingFileType = {
        id: uuid(),
        status: 'pending',
        progress: 0,
        lastProgress: new Date().getTime(),
        speed: 0,
        uploadTaskId: this.currentTaskId,
        originalFile: file.file,
        backendFile: null,
        resumable: null,
        type: 'file',
        label: null,
        pausable: true,
      };

      this.pendingFiles.push(pendingFile);
      if (!this.GroupedPendingFiles[file.root]) {
        this.GroupedPendingFiles[file.root] = [];
      }
      this.GroupedPendingFiles[file.root].push(pendingFile);
      this.notify();

      // First we create the file object
      const resource = (
        await FileUploadAPIClient.upload(file.file, { companyId, ...(options?.context || {}) })
      )?.resource;

      if (!resource) {
        throw new Error('A server error occured');
      }

      pendingFile.backendFile = resource;
      this.notify();

      // Then we overwrite the file object with resumable
      pendingFile.resumable = this.getResumableInstance({
        target: FileUploadAPIClient.getRoute({
          companyId,
          fileId: pendingFile.backendFile.id,
          fullApiRouteUrl: true,
        }),
        query: {
          thumbnail_sync: 1,
        },
        headers: {
          Authorization: JWTStorage.getAutorizationHeader(),
        },
      });

      pendingFile.resumable.addFile(file.file);

      pendingFile.resumable.on('fileAdded', () => pendingFile.resumable.upload());

      pendingFile.resumable.on('fileProgress', (f: any) => {
        const bytesDelta =
          (f.progress() - pendingFile.progress) * (pendingFile?.originalFile?.size || 0);
        const timeDelta = new Date().getTime() - pendingFile.lastProgress;

        // To avoid jumping time ?
        if (timeDelta > 1000) {
          pendingFile.speed = bytesDelta / timeDelta;
        }

        pendingFile.backendFile = f;
        pendingFile.lastProgress = new Date().getTime();
        pendingFile.progress = f.progress();
        this.notify();
      });

      pendingFile.resumable.on('fileSuccess', (_f: any, message: string) => {
        try {
          pendingFile.backendFile = JSON.parse(message).resource;
          pendingFile.status = 'success';
          options?.callback?.(pendingFile.backendFile, options?.context || {});
          this.notify();
        } catch (e) {
          logger.error(`Error on fileSuccess Event`, e);
        }
      });

      pendingFile.resumable.on('fileError', () => {
        pendingFile.status = 'error';
        pendingFile.resumable.cancel();
        const intendedFilename =
          (pendingFile.originalFile || {}).name ||
          (pendingFile.backendFile || { metadata: {} }).metadata.name;
        ToasterService.error(
          Languages.t(
            'services.file_upload_service.toaster.upload_file_error',
            [intendedFilename],
            'Error uploading file ' + intendedFilename,
          ),
        );
        options?.callback?.(null, options?.context || {});
        this.notify();
      });
    }

    return this.pendingFiles.filter(f => f.uploadTaskId === this.currentTaskId);
  }

  public async getFile({
    companyId,
    fileId,
  }: {
    fileId: string;
    companyId: string;
  }): Promise<FileType> {
    return _.cloneDeep((await FileUploadAPIClient.get({ fileId, companyId }))?.resource);
  }

  public getPendingFile(id: string): PendingFileType {
    return this.pendingFiles.filter(f => f.id === id)[0];
  }

  public getPendingFileByBackendId(id: string): PendingFileType {
    return this.pendingFiles.filter(f => f.backendFile?.id && f.backendFile.id === id)[0];
  }

  public cancelRoot(id: string, timeout = 1000) {
    const filesToCancel = this.GroupedPendingFiles[id];

    for (const file of filesToCancel) {
      file.status = 'cancel';
      if (file.resumable) {
        file.resumable.cancel();
        if (file.backendFile)
          this.deleteOneFile({
            companyId: file.backendFile.company_id,
            fileId: file.backendFile.id,
          });
      }
    }

    setTimeout(() => {
      this.pendingFiles = this.pendingFiles.filter(f => f.id !== id);
      this.notify();
    }, timeout);
  }

  public cancelUpload() {
    this.uploadStatus === UploadStateEnum.Cancelled;

    // pause or resume the resumable tasks
    const fileToCancel = this.pendingFiles;

    if (!fileToCancel) {
      console.error(`No files found for id`);
      return;
    }

    for (const file of fileToCancel) {
      if (file.status === 'success') continue;

      try {
        if (file.resumable) {
          file.resumable.cancel();
          if (file.backendFile)
            this.deleteOneFile({
              companyId: file.backendFile.company_id,
              fileId: file.backendFile.id,
            });
        } else {
          console.warn('Resumable object is not available for file', file);
        }
      } catch (error) {
        console.error('Error while pausing or resuming file', file, error);
      }
    }

    // clean everything
    this.pendingFiles = [];
    this.GroupedPendingFiles = {};
    this.RootSizes = {};
    this.GroupIds = {};

    this.notify();
  }

  public retry(id: string) {
    const fileToRetry = this.pendingFiles.filter(f => f.id === id)[0];

    if (fileToRetry.status === 'error') {
      fileToRetry.status = 'pending';
      fileToRetry.resumable.upload();

      this.notify();
    }
  }

  private pauseOrResumeFile(file: PendingFileType) {
    try {
      if (file.resumable) {
        if (file.status !== 'pause') {
          file.status = 'pause';
          file.resumable.pause();
        } else {
          file.status = 'pending';
          file.resumable.upload();
        }
      } else {
        console.warn('Resumable object is not available for file', file);
      }
    } catch (error) {
      console.error('Error while pausing or resuming file', file, error);
    }
  }

  public pauseOrResume() {
    // pause or resume the curent upload task
    switch (this.uploadStatus) {
      case UploadStateEnum.Progress:
        this.uploadStatus = UploadStateEnum.Paused;
        break;
      case UploadStateEnum.Paused:
        this.uploadStatus = UploadStateEnum.Progress;
        break;
      case UploadStateEnum.Cancelled:
        throw new Error('Cannot toggle upload status: Upload is cancelled.');
      default:
        throw new Error(`Unexpected upload status: ${this.uploadStatus}`);
    }

    // pause or resume the resumable tasks
    const filesToProcess = this.pendingFiles;

    if (!filesToProcess || filesToProcess.length === 0) {
      console.error(`No files found for id`);
      return;
    }

    for (const file of filesToProcess) {
      if (file.status === 'success') continue;
      this.pauseOrResumeFile(file);
    }

    // update the status of the roots
    const roots = Object.keys(this.GroupedPendingFiles);
    for (const root of roots) {
      if (this.uploadStatus === UploadStateEnum.Paused) {
        this.pausedRoots[root] = true;
      } else {
        this.pausedRoots[root] = false;
      }
    }

    this.notify();
  }

  public pauseOrResumeRoot(id: string) {
    // set the pause status for the root
    if (Object.keys(this.pausedRoots).includes(id)) {
      this.pausedRoots[id] = !this.pausedRoots[id];
    } else {
      this.pausedRoots[id] = true;
    }

    // pause or resume the resumable tasks
    const filesToProcess = this.GroupedPendingFiles[id];

    if (!filesToProcess || filesToProcess.length === 0) {
      console.error(`No files found for id: ${id}`);
      return;
    }

    for (const file of filesToProcess) {
      if (file.status === 'success') continue;

      // pause or resume the file
      this.pauseOrResumeFile(file);
    }

    this.notify();
  }

  private getResumableInstance({
    target,
    headers,
    chunkSize,
    testChunks,
    simultaneousUploads,
    maxChunkRetries,
    query,
  }: {
    target: string;
    headers: { Authorization: string };
    chunkSize?: number;
    testChunks?: number;
    simultaneousUploads?: number;
    maxChunkRetries?: number;
    query?: { [key: string]: any };
  }) {
    return new Resumable({
      target,
      headers,
      chunkSize: chunkSize || 5000000,
      testChunks: testChunks || false,
      simultaneousUploads: simultaneousUploads || 5,
      maxChunkRetries: maxChunkRetries || 2,
      query,
    });
  }

  public async deleteOneFile({
    companyId,
    fileId,
  }: {
    companyId: string;
    fileId: string;
  }): Promise<void> {
    const response = await FileUploadAPIClient.delete({ companyId, fileId });

    if (response.status === 'success') {
      this.pendingFiles = this.pendingFiles.filter(f => f.backendFile?.id !== fileId);
      this.notify();
    } else {
      logger.error(`Error while processing delete for file`, fileId);
    }
  }

  public download({ companyId, fileId }: { companyId: string; fileId: string }): Promise<Blob> {
    return FileUploadAPIClient.download({
      companyId: companyId,
      fileId: fileId,
    });
  }

  public getDownloadRoute({ companyId, fileId }: { companyId: string; fileId: string }): string {
    return FileUploadAPIClient.getDownloadRoute({
      companyId: companyId,
      fileId: fileId,
    });
  }

  public clearRoots() {
    this.GroupedPendingFiles = {};
    this.GroupIds = {};
    this.notify();
  }
}

export default new FileUploadService();
