import FileUploadService from '@features/files/services/file-upload-service';
import RouterServices from '@features/router/services/router-service';
import { useRecoilState, useRecoilValue } from 'recoil';
import { PendingFilesListState } from '../state/atoms/pending-files-list';
import { CurrentTaskSelector } from '../state/selectors/current-task';

export const useUpload = () => {
  const { companyId } = RouterServices.getStateFromRoute();
  const [pendingFilesListState, setPendingFilesListState] = useRecoilState(PendingFilesListState);
  FileUploadService.setRecoilHandler(setPendingFilesListState);

  const currentTask = useRecoilValue(CurrentTaskSelector);

  const pauseOrResumeUpload = (id: string) => FileUploadService.pauseOrResume(id);

  const cancelUpload = (id: string) => FileUploadService.cancel(id);

  const getOnePendingFile = (id: string) => FileUploadService.getPendingFile(id);

  const deleteOneFile = (id: string) => {
    if (companyId) FileUploadService.deleteOneFile({ companyId, fileId: id });
  };

  const retryUpload = (id: string) => FileUploadService.retry(id);

  return {
    pendingFilesListState,
    pauseOrResumeUpload,
    cancelUpload,
    getOnePendingFile,
    currentTask,
    deleteOneFile,
    retryUpload,
  };
};
