import FileUploadService from '@features/files/services/file-upload-service';
import RouterServices from '@features/router/services/router-service';
import { useRecoilState, useRecoilValue } from 'recoil';
import { PendingFilesListState } from '../state/atoms/pending-files-list';
import { RootPendingFilesListState } from '../state/atoms/root-pending-files-list';
import { CurrentTaskSelector } from '../state/selectors/current-task';

export const useUpload = () => {
  const { companyId } = RouterServices.getStateFromRoute();
  const [pendingFilesListState, _setPendingFilesListState] = useRecoilState(PendingFilesListState);
  const [_rootPendingFilesListState, setRootPendingFilesListState] =
    useRecoilState(RootPendingFilesListState);
  FileUploadService.setRecoilHandler(setRootPendingFilesListState);

  const currentTask = useRecoilValue(CurrentTaskSelector);

  const pauseOrResumeUpload = () => FileUploadService.pauseOrResume();

  const pauseOrResumeRootUpload = (id: string) => FileUploadService.pauseOrResumeRoot(id);

  const cancelUpload = () => FileUploadService.cancelUpload();

  const cancelRootUpload = (id: string) => FileUploadService.cancelRootUpload(id);

  const getOnePendingFile = (id: string) => FileUploadService.getPendingFile(id);

  const deleteOneFile = (id: string) => {
    if (companyId) FileUploadService.deleteOneFile({ companyId, fileId: id });
  };

  const retryUpload = (id: string) => FileUploadService.retry(id);

  const clearRoots = () => FileUploadService.clearRoots();

  return {
    pendingFilesListState,
    pauseOrResumeUpload,
    pauseOrResumeRootUpload,
    cancelUpload,
    cancelRootUpload,
    getOnePendingFile,
    currentTask,
    deleteOneFile,
    retryUpload,
    clearRoots,
  };
};
