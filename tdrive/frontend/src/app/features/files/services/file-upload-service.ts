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
import { DriveItem, DriveItemVersion } from 'app/features/drive/types';

export enum Events {
  ON_CHANGE = 'notify',
}

export enum UploadStateEnum {
  Progress = 'progress',
  Completed = 'completed',
  Paused = 'paused',
  Cancelled = 'cancelled',
  Failed = 'failed',
}

type RootState = { [key: string]: boolean };

const logger = Logger.getLogger('Services/FileUploadService');
class FileUploadService {
  private pendingFiles: PendingFileType[] = [];
  private groupedPendingFiles: { [key: string]: PendingFileType[] } = {};
  private rootSizes: { [key: string]: number } = {};
  private groupIds: { [key: string]: string } = {};
  private rootStates: {
    paused: RootState;
    cancelled: RootState;
    completed: RootState;
    failed: RootState;
  } = {
    paused: {},
    cancelled: {},
    completed: {},
    failed: {},
  };
  public currentTaskId = '';
  public parentId = '';
  public uploadStatus = UploadStateEnum.Progress;
  private companyId = '';
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
    logger.debug('===== _waitWhilePaused ======');
    logger.debug('rootStates: ', this.rootStates);
    logger.debug('status: ', this.uploadStatus);
    while (this.uploadStatus === UploadStateEnum.Paused || (id && this.rootStates.paused[id])) {
      if (this.uploadStatus === UploadStateEnum.Cancelled || (id && this.rootStates.cancelled[id]))
        return;
      await new Promise(resolve => setTimeout(resolve, 100)); // Check every 100ms
    }
  }

  /**
   * Helper method to cancel execution when `isCancelled` is true.
   * @private
   */
  private async checkCancellation(id?: string) {
    if (this.uploadStatus === UploadStateEnum.Cancelled || (id && this.rootStates.cancelled[id])) {
      logger.warn('Operation cancelled.');
      throw new Error('Upload process cancelled.');
    }
  }

  notify() {
    const updatedState = Object.keys(this.groupedPendingFiles).reduce((acc: any, key: string) => {
      // Calculate the uploaded size
      const uploadedSize = this.groupedPendingFiles[key]
        .map((file: PendingFileType) => {
          const fileSize = file.originalFile?.size ?? 0;

          if (file.status === 'success') {
            return fileSize;
          } else if (file.status === 'pending') {
            return fileSize * (file.progress ?? 0); // Ensure progress is defined
          }

          return 0;
        })
        .reduce((acc: number, size: number) => acc + size, 0);

      // Check for failed files
      const failedFiles = this.groupedPendingFiles[key].filter(f => f.status === 'error');
      if (failedFiles.length > 0) {
        this.rootStates.failed[key] = true;
      }

      // Check if the root is a file with unknow format
      const isUnknownFormat =
        this.groupedPendingFiles[key]?.length === 1 &&
        this.groupedPendingFiles[key][0].originalFile?.name === key;

      // Determine the upload status based on failed, cancelled, paused, completed, or uploading states
      const status = this.rootStates.failed[key]
        ? 'failed'
        : this.rootStates.cancelled[key]
        ? 'cancelled'
        : this.rootStates.paused[key]
        ? 'paused'
        : uploadedSize === this.rootSizes[key]
        ? 'completed'
        : 'uploading';

      if (status === 'completed') {
        this.rootStates.completed[key] = true;
      }

      // Add to the accumulator object
      acc[key] = {
        id: this.groupIds[key],
        items: [],
        size: this.rootSizes[key],
        uploadedSize,
        status,
        isUnknownFormat,
      };

      return acc;
    }, {});

    this.recoilHandler(_.cloneDeep(updatedState));
  }

  public async createDirectories(
    tree: FileTreeObject,
    context: { companyId: string; parentId: string },
  ) {
    // reset the upload status
    this.uploadStatus = UploadStateEnum.Progress;
    this.companyId = context.companyId;

    const root = tree.tree;
    this.rootSizes = this.rootSizes = {
      ...this.rootSizes,
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
        await this.checkCancellation(root);
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
            if (!this.groupIds[directory]) this.groupIds[directory] = driveItem.id;
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
        callback: async (filePayload, context) => {
          const isFileRoot = filePayload.root.includes('.');
          const root = filePayload.root;
          const file = filePayload.file;
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
            try {
              const documentId = await DriveApiClient.create(context.companyId, { item, version });
              // assign the group id with the document id
              if (isFileRoot) {
                this.groupIds[root] = documentId.id;
                // set the id for the root
                this.notify();
              }
            } catch (error) {
              logger.error('Error while creating document', error);
            }
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
      logger.error('Error while processing tree', error);
    }

    // await traverserTreeLevel(root, context.parentId, true);

    return { filesPerParentId, idsToBeRestored };
  }

  public async upload(
    fileList: { root: string; file: File }[],
    options?: {
      context?: any;
      callback?: (file: { root: string; file: FileType | null }, context: any) => void;
    },
  ): Promise<PendingFileType[]> {
    logger.debug('===== upload =====');
    logger.debug('uploadStatus: ', this.uploadStatus);

    // reset the upload status when creating a new document
    if (fileList.length === 1 && fileList[0].root === fileList[0].file.name) {
      if (this.uploadStatus === UploadStateEnum.Paused) {
        this.uploadStatus = UploadStateEnum.Progress;
      }
    }

    // if we're uploading one file directly, do the size calc first
    for (const file of fileList) {
      if (file.root && file.file?.name && file.root === file.file.name) {
        this.rootSizes[file.root] = file.file.size;
      }
    }

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
      // cancel upload
      await this.checkCancellation(file.root);
      // wait here if the upload is paused
      await this._waitWhilePaused(file.root);
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
      if (!this.groupedPendingFiles[file.root]) {
        this.groupedPendingFiles[file.root] = [];
      }
      this.groupedPendingFiles[file.root].push(pendingFile);
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
          options?.callback?.(
            { root: file.root, file: pendingFile.backendFile },
            options?.context || {},
          );
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
        options?.callback?.({ root: file.root, file: null }, options?.context || {});
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

  public cancelUpload() {
    this.uploadStatus = UploadStateEnum.Cancelled;
    // copy the group ids
    const rootItemIds = _.cloneDeep(this.groupIds);

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

    // delete the roots in progress
    for (const rootItem of Object.keys(rootItemIds)) {
      const rootItemId = rootItemIds[rootItem];
      // check if the root completed skip it
      if (this.rootStates.completed[rootItem]) continue;
      this.deleteOneDriveItem({
        companyId: this.companyId,
        id: rootItemId,
      });
    }

    // clean everything
    this.pendingFiles = [];
    this.groupedPendingFiles = {};
    this.rootSizes = {};
    this.groupIds = {};

    this.notify();
  }

  public cancelRootUpload(id: string) {
    this.rootStates.cancelled[id] = true;
    const rootItemId = this.groupIds[id];
    // if it's 1 root, cancel the upload
    if (Object.keys(this.groupedPendingFiles).length === 1) {
      this.cancelUpload();
      return;
    } else {
      // pause or resume the resumable tasks
      const filesToProcess = this.groupedPendingFiles[id];

      if (!filesToProcess || filesToProcess.length === 0) {
        console.error(`No files found for id: ${id}`);
        return;
      }

      for (const file of filesToProcess) {
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
      this.pendingFiles = this.pendingFiles.filter(f => f.uploadTaskId !== id);
      // remove the root key
      this.groupedPendingFiles[id] = [];
      // remove the root size
      delete this.rootSizes[id];
      // remove the root id
      delete this.groupIds[id];
      this.notify();

      // delete the root
      this.deleteOneDriveItem({
        companyId: this.companyId,
        id: rootItemId,
      });
    }
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
    const roots = Object.keys(this.groupedPendingFiles);
    for (const root of roots) {
      // check if the root has completed skip it
      if (this.rootStates.completed[root]) continue;
      if (this.uploadStatus === UploadStateEnum.Paused) {
        this.rootStates.paused[root] = true;
      } else {
        this.rootStates.paused[root] = false;
      }
    }

    this.notify();
  }

  public pauseOrResumeRoot(id: string) {
    const completedRoots = Object.keys(this.rootStates.completed);
    const roots = Object.keys(this.rootSizes);
    const isOnlyRootInProgress = roots.length - completedRoots.length === 1;

    // Check if this is the only root in progress
    if (!this.rootStates.completed[id] && isOnlyRootInProgress) {
      this.uploadStatus =
        this.uploadStatus === UploadStateEnum.Progress
          ? UploadStateEnum.Paused
          : UploadStateEnum.Progress;
    }

    // set the pause status for the root
    if (Object.keys(this.rootStates.paused).includes(id)) {
      this.rootStates.paused[id] = !this.rootStates.paused[id];
    } else {
      this.rootStates.paused[id] = true;
    }

    // pause or resume the resumable tasks
    const filesToProcess = this.groupedPendingFiles[id];

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
      xhrTimeout: 60000,
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

  public async deleteOneDriveItem({
    companyId,
    id,
  }: {
    companyId: string;
    id: string;
  }): Promise<void> {
    try {
      await DriveApiClient.remove(companyId, id);
    } catch (error) {
      logger.error('Error while deleting drive item ', error);
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
    this.groupedPendingFiles = {};
    this.groupIds = {};
    this.notify();
  }

  public resetStates(ids: string[]) {
    this.logger.debug('===== START resetStates =====');
    this.logger.debug('groupedPendingFiles: ', this.groupedPendingFiles);
    this.logger.debug('groupIds: ', this.groupIds);
    this.logger.debug('rootStates: ', this.rootStates);

    this.uploadStatus = UploadStateEnum.Progress;
    for (const id of ids) {
      delete this.groupedPendingFiles[id];
      delete this.groupIds[id];
      delete this.rootStates.paused[id];
      delete this.rootStates.completed[id];
      delete this.rootStates.failed[id];
      delete this.rootStates.cancelled[id];
    }

    this.logger.debug('===== END resetStates =====');
    this.logger.debug('groupedPendingFiles: ', this.groupedPendingFiles);
    this.logger.debug('groupIds: ', this.groupIds);
    this.logger.debug('rootStates: ', this.rootStates);
  }
}

export default new FileUploadService();
