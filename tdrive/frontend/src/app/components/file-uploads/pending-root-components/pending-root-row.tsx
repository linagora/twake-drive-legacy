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

const PendingRootRow = ({
  rootKey,
  root,
  parentId,
}: {
  rootKey: string;
  root: UploadRootType;
  parentId: string;
}): JSX.Element => {
  const { pauseOrResumeRootUpload, cancelRootUpload, clearRoots } = useUpload();
  const [showFolder, setShowFolder] = useState(false);
  const [restoredFolder, setRestoredFolder] = useState(false);
  const { restore } = useDriveActions();
  const { refresh } = useDriveItem(parentId || '');

  const firstPendingFile = root.items[0];
  const uploadedFilesSize = root.uploadedSize;
  const uploadProgress = Math.floor((uploadedFilesSize / root.size) * 100);
  const isUploadCompleted = root.status === 'completed';
  const isFileRoot = rootKey.includes('.');

  // Callback function to open the folder after the upload is completed
  const handleShowFolder = useCallback(() => {
    if (!showFolder || isFileRoot) return;
    RouterService.push(RouterService.generateRouteFromState({ dirId: root.id || '' }));
    clearRoots();
  }, [showFolder, isFileRoot, root, clearRoots]);

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

  useEffect(() => {
    const postProcess = async () => {
      if (isUploadCompleted && !restoredFolder) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await restore(root.id, parentId);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await refresh(parentId);
      }
    };
    if (isUploadCompleted && !restoredFolder) {
      setRestoredFolder(true);
      postProcess();
    }
  }, [isUploadCompleted]);

  return (
    <div className="root-row">
      <div className="root-details mt-2">
        <div className="flex items-center">
          <div className="w-10 h-10 flex items-center justify-center bg-[#f3f3f7] rounded-md">
            <div className="w-full h-full flex items-center justify-center">
              {itemTypeIcon(firstPendingFile?.type)}
            </div>
          </div>
          <p className="ml-4">{rootKey}</p>

          <div className="progress-check flex items-center justify-center ml-auto">
            {isUploadCompleted ? (
              <button onClick={handleShowFolder}>
                {!isFileRoot && (
                  <>
                    <CheckGreenIcon
                      className={`transition-opacity ${
                        showFolder ? 'opacity-0 w-0 h-0' : 'opacity-1'
                      }`}
                    />
                    <ShowFolderIcon
                      className={`transition-opacity duration-300 ${
                        showFolder ? 'opacity-1' : 'opacity-0 w-0 h-0'
                      }`}
                    />
                  </>
                )}
                {isFileRoot && <CheckGreenIcon className="opacity-1" />}
              </button>
            ) : (
              firstPendingFile?.status !== 'cancel' &&
              firstPendingFile?.status !== 'error' && (
                <>
                  <button onClick={() => pauseOrResumeRootUpload(rootKey)}>
                    {root.status === 'paused' ? <ResumeIcon /> : <PauseIcon />}
                  </button>
                  <button className="ml-2" onClick={() => cancelRootUpload(rootKey)}>
                    <CancelIcon />
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
            <div className="h-full bg-[#00A029]" style={{ width: `${uploadProgress}%` }}></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingRootRow;
