import { useState, useMemo, useCallback } from 'react';
import { useUpload } from '@features/files/hooks/use-upload';
import PerfectScrollbar from 'react-perfect-scrollbar';
import { ArrowDownIcon, ArrowUpIcon } from 'app/atoms/icons-colored';
import { UploadRootListType } from 'app/features/files/types/file';
import Languages from '@features/global/services/languages-service';
import PendingRootRow from './pending-root-row';
import { UploadStateEnum } from 'app/features/files/services/file-upload-service';

const getFilteredRoots = (keys: string[], roots: UploadRootListType) => {
  const inProgress = keys.filter(key => roots[key].status === 'uploading');
  const completed = keys.filter(key => roots[key].status === 'completed');
  const paused = keys.filter(key => roots[key].status === 'paused');
  return { inProgress, completed, paused };
};

interface ModalHeaderProps {
  uploadingCount: number;
  completedCount: number;
  totalRoots: number;
  uploadingPercentage: number;
  toggleModal: () => void;
  modalExpanded: boolean;
}

const ModalHeader: React.FC<ModalHeaderProps> = ({
  uploadingCount,
  completedCount,
  totalRoots,
  uploadingPercentage,
  toggleModal,
  modalExpanded,
}) => (
  <div className="w-full flex bg-[#45454A] text-white p-4 items-center justify-between">
    <p className="testid:upload-root-modal-head-status">
      {uploadingCount > 0
        ? `${Languages.t('general.uploading')} ${uploadingCount}`
        : `${Languages.t('general.uploaded')} ${completedCount}`}{' '}
      {Languages.t('general.files')}
    </p>
    <button
      className="ml-auto flex items-center testid:upload-root-modal-toggle-arrow"
      onClick={toggleModal}
    >
      {modalExpanded ? <ArrowDownIcon /> : <ArrowUpIcon />}
    </button>
  </div>
);

interface ModalFooterProps {
  pauseOrResumeUpload: () => void;
  cancelUpload: () => void;
  isPaused: () => boolean;
  uploadingCount: number;
}

const ModalFooter: React.FC<ModalFooterProps> = ({
  pauseOrResumeUpload,
  cancelUpload,
  isPaused,
  uploadingCount,
}) => {
  const pauseResumeBtnTestId = isPaused() ? 'testid:upload-root-modal-pause' : 'testid:upload-root-modal-resume';
  const cancelCloseBtnTestId = uploadingCount ? 'testid:upload-root-modal-cancel' : 'testid:upload-root-modal-close';

  return (
    <div className="w-full flex flex-wrap bg-[#F0F2F3] text-black p-4 items-center justify-between">
      <div className="w-full flex flex-wrap gap-2 justify-center sm:justify-end">
        {uploadingCount > 0 && (
          <button
            className={`text-blue-500 px-4 py-2 rounded bg-transparent transition-all duration-300 ease-in-out 
            hover:bg-blue-600 hover:text-white w-full sm:w-auto ${pauseResumeBtnTestId}`}
            onClick={pauseOrResumeUpload}
          >
            {isPaused() ? Languages.t('general.resume') : Languages.t('general.pause')}
          </button>
        )}
        <button
          className={`text-blue-500 min-w-[100px] px-4 py-2 rounded bg-transparent transition-all duration-300 ease-in-out 
          hover:bg-blue-600 hover:text-white w-full sm:w-auto ${cancelCloseBtnTestId}`}
          onClick={cancelUpload}
        >
          {uploadingCount ? Languages.t('general.cancel') : Languages.t('general.close')}
        </button>
      </div>
    </div>
  );
}

const PendingRootList = ({
  roots,
  status,
  parentId,
}: {
  roots: UploadRootListType;
  status: UploadStateEnum;
  parentId: string;
}): JSX.Element => {
  const [modalExpanded, setModalExpanded] = useState(true);
  const { pauseOrResumeUpload, cancelUpload } = useUpload();
  const keys = useMemo(() => Object.keys(roots || {}), [roots]);

  const {
    inProgress: rootsInProgress,
    completed: rootsCompleted,
    paused: rootsPaused,
  } = useMemo(() => getFilteredRoots(keys, roots), [keys, roots]);

  const isPaused = useCallback(() => status === UploadStateEnum.Paused, [status]);

  const totalRoots = keys.length;
  const uploadingCount = rootsInProgress.length;
  const completedCount = rootsCompleted.length;
  const pausedCount = rootsPaused.length;
  const uploadingPercentage = Math.floor((uploadingCount / totalRoots) * 100) || 100;

  const toggleModal = useCallback(() => setModalExpanded(prev => !prev), []);

  return (
    <>
      {totalRoots > 0 && (
        <div
          className="fixed bottom-4 right-4 w-full sm:w-1/2 md:w-1/3 max-w-lg shadow-lg rounded-sm overflow-hidden testid:upload-root-modal 
                sm:right-4 sm:left-auto sm:translate-x-0 left-1/2 -translate-x-1/2"
        >
          <ModalHeader
            uploadingCount={uploadingCount + pausedCount}
            completedCount={completedCount}
            totalRoots={totalRoots}
            uploadingPercentage={uploadingPercentage}
            toggleModal={toggleModal}
            modalExpanded={modalExpanded}
          />

          <div className={`modal-body ${modalExpanded ? 'block' : 'hidden'}`}>
            <div className="bg-white px-4 py-2">
              <PerfectScrollbar
                options={{ suppressScrollX: true, suppressScrollY: false }}
                component="div"
                style={{ width: '100%', maxHeight: 300 }}
              >
                {keys.map(key => (
                  <PendingRootRow key={key} rootKey={key} root={roots[key]} />
                ))}
              </PerfectScrollbar>
            </div>
            <ModalFooter
              pauseOrResumeUpload={pauseOrResumeUpload}
              cancelUpload={cancelUpload}
              isPaused={isPaused}
              uploadingCount={uploadingCount + pausedCount}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default PendingRootList;
