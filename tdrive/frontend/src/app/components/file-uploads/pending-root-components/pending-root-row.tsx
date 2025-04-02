import { useEffect, useState, useCallback } from 'react';
import { useUpload } from '@features/files/hooks/use-upload';
import RouterService from '@features/router/services/router-service';
import { UploadRootType } from 'app/features/files/types/file';
import {
  FileTypeUnknownIcon,
  FolderIcon,
  CheckGreenIcon,
  PauseIcon,
  CancelIcon,
  ResumeIcon,
  ShowFolderIcon,
} from 'app/atoms/icons-colored';
import { fileTypeIconsMap } from './file-type-icon-map';
import { useDriveActions } from 'app/features/drive/hooks/use-drive-actions';
import { useDriveItem } from 'app/features/drive/hooks/use-drive-item';
import Languages from 'app/features/global/services/languages-service';
import useRouteState from 'app/features/router/hooks/use-route-state';

const PendingRootRow = ({
  rootKey,
  root,
}: {
  rootKey: string;
  root: UploadRootType;
}): JSX.Element => {
  const { dirId } = useRouteState();
  const { pauseOrResumeRootUpload, cancelRootUpload, clearRoots } = useUpload();
  const [showFolder, setShowFolder] = useState(false);
  const [restoredFolder, setRestoredFolder] = useState(false);
  const { item } = useDriveItem(root?.id || '');
  const { restore } = useDriveActions();
  const { refresh, children } = useDriveItem(item?.parent_id || '');

  const uploadedFilesSize = root.uploadedSize;
  const uploadProgress = Math.floor((uploadedFilesSize / root.size) * 100);
  const isUploadCompleted = root.status === 'completed';
  const isFileRoot = root.isFileRoot;
  const fileType = isFileRoot && rootKey.includes('.') ? rootKey.split('.').pop() : '';

  // Callback function to open the folder after the upload is completed
  const handleShowFolder = useCallback(() => {
    if (!showFolder || isFileRoot) {
      const redirectionURL = RouterService.generateRouteFromState({
        itemId: root.id,
        dirId: item?.parent_id || '',
      });
      window.open(redirectionURL, '_blank');
    } else {
      RouterService.push(RouterService.generateRouteFromState({ dirId: root.id || '' }));
    }
  }, [showFolder, root, isFileRoot, clearRoots]);

  // Function to determine the icon for the root
  // If the root is a file, it will show the file icon based on the content type
  // If the root is a folder, it will show the folder icon
  const itemTypeIcon = useCallback(
    (type: string) =>
      isFileRoot ? (
        fileTypeIconsMap[type as keyof typeof fileTypeIconsMap] || <FileTypeUnknownIcon />
      ) : (
        <FolderIcon />
      ),
    [isFileRoot],
  );

  // A timeout to show the folder icon after the upload is completed
  // This is to give a visual feedback to the user and will be shown shortly
  // after the green check icon appears
  useEffect(() => {
    if (isUploadCompleted) {
      const timeout = setTimeout(async () => {
        setShowFolder(true);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [isUploadCompleted]);

  const waitForChild = async (itemId: string, retries = 5, interval = 1000) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      await new Promise(resolve => setTimeout(resolve, interval));
      if (children.some(child => child.id === itemId)) return true;
    }
    return false;
  };

  useEffect(() => {
    const postProcess = async () => {
      if (isUploadCompleted && !restoredFolder) {
        if (!isFileRoot) await restore(root.id, item?.parent_id || '');
        const found = isFileRoot || (await waitForChild(root.id));
        if (found) await refresh(item?.parent_id || '');
      }
    };
    if (isUploadCompleted && root.id && !restoredFolder) {
      setRestoredFolder(true);
      postProcess();
    }
  }, [isUploadCompleted]);

  // Helper to convert size to the closest unit
  const formatFileSize = (sizeInBytes: number): string => {
    if (sizeInBytes) {
      if (sizeInBytes < 1024) return `${sizeInBytes} Bytes`;
      if (sizeInBytes < 1024 ** 2) return `${(sizeInBytes / 1024).toFixed(2)} KB`;
      if (sizeInBytes < 1024 ** 3) return `${(sizeInBytes / 1024 ** 2).toFixed(2)} MB`;
      return `${(sizeInBytes / 1024 ** 3).toFixed(2)} GB`;
    } else {
      return '0 Bytes';
    }
  };

  // Helper to truncate the root name / key if it is too long
  const truncateRootName = (rootName: string): string => {
    if (rootName.length > 30) {
      return `${rootName.substring(0, 20)}...`;
    }
    return rootName;
  };

  const showFileFolderTestId =
    !showFolder || isFileRoot
      ? 'testid:upload-root-modal-row-show-file'
      : 'testid:upload-root-modal-row-show-folder';

  const showCheckGreenIconOpenFile = isFileRoot && ((dirId && item?.parent_id === dirId) || !dirId);

  return (
    <div className="root-row testid:upload-root-modal-row">
      <div className="root-details mt-2">
        <div className="flex items-center">
          <div className="w-10 h-10 flex items-center justify-center bg-[#f3f3f7] rounded-md">
            <div className="w-full h-full flex items-center justify-center testid:upload-root-modal-row-type">
              {itemTypeIcon(fileType || '')}
            </div>
          </div>
          <p className="ml-4">
            <span className="font-bold">{truncateRootName(rootKey)} </span>
            {root.status !== 'failed' && root.uploadedSize > 0 && (
              <span className="ml-4 text-sm">
                ({formatFileSize(root.uploadedSize)} / {formatFileSize(root.size)})
              </span>
            )}
            {root.status === 'failed' && (
              <span className="ml-4 text-red-500">{Languages.t('general.upload_failed')}</span>
            )}
          </p>

          <div className="progress-check flex items-center justify-center ml-auto">
            {isUploadCompleted && root.id ? (
              <button
                onClick={handleShowFolder}
                className={`hover:bg-gray-100 p-2 rounded-md transition-all duration-200 ${showFileFolderTestId}`}
              >
                {!isFileRoot && (
                  <>
                    <CheckGreenIcon
                      className={`transition-opacity ${
                        showFolder ? 'opacity-0 w-0 h-0' : 'opacity-1 hover:scale-110'
                      }`}
                    />
                    <ShowFolderIcon
                      className={`transition-opacity duration-300 ${
                        showFolder ? 'opacity-1 hover:scale-110' : 'opacity-0 w-0 h-0'
                      }`}
                    />
                  </>
                )}
                {showCheckGreenIconOpenFile && (
                  <CheckGreenIcon className="opacity-1 hover:scale-110 transition-transform duration-200" />
                )}
              </button>
            ) : (
              !['cancelled', 'failed'].includes(root.status) &&
              root?.status !== 'error' && (
                <>
                  {root.status === 'paused' ? (
                    <button
                      onClick={() => pauseOrResumeRootUpload(rootKey)}
                      className="hover:bg-blue-100 p-2 rounded-md transition-all duration-200 testid:upload-root-modal-row-resume"
                    >
                      <ResumeIcon className="hover:scale-110 transition-transform duration-200" />
                    </button>
                  ) : (
                    <button
                      onClick={() => pauseOrResumeRootUpload(rootKey)}
                      className="hover:bg-blue-100 p-2 rounded-md transition-all duration-200 testid:upload-root-modal-row-pause"
                    >
                      <PauseIcon className="hover:scale-110 transition-transform duration-200" />
                    </button>
                  )}
                  <button
                    className="ml-2 hover:bg-red-100 p-2 rounded-md transition-all duration-200 testid:upload-root-modal-row-cancel"
                    onClick={() => cancelRootUpload(rootKey)}
                  >
                    <CancelIcon className="hover:scale-110 transition-transform duration-200" />
                  </button>
                </>
              )
            )}
          </div>
        </div>
      </div>

      <div className="root-progress h-[3px] mt-4">
        {!showFolder && (
          <div className="w-full h-[3px] bg-[#F0F2F3]">
            <div
              className={`testid:upload-root-modal-row-progress h-full ${
                root.status === 'failed'
                  ? 'bg-[#FF0000]' // Red color for failed uploads
                  : root.status === 'cancelled'
                  ? 'bg-[#FFA500]' // Orange for cancelled uploads
                  : 'bg-[#00A029]' // Green for successful uploads
              }`}
              style={{
                width: `${
                  root.status === 'failed' || root.status === 'cancelled' ? 100 : uploadProgress
                }%`,
              }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingRootRow;
