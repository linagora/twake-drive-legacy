import { useEffect } from 'react';
import FileUploadService from '@features/files/services/file-upload-service';
import { AttachedFileType } from '@features/files/types/file';
import { useRecoilState } from 'recoil';
import { PendingUploadZonesListState } from '../state/atoms/pending-upload-zones-list';
import { useUpload } from './use-upload';
import { FileType, PendingFileType } from '@features/files/types/file';

export const useUploadZones = (zoneId: string) => {
  const { currentTask, getOnePendingFile } = useUpload();
  const [files, setFiles] = useRecoilState(PendingUploadZonesListState(zoneId));

  useEffect(() => {
    if (currentTask.files.length > 0) {
      const updated = files.map(f => {
        const upToDate = getOnePendingFile((f.metadata?.external_id as string) || '');
        if (upToDate) {
          f = pendingFileToMessageFile(f, upToDate);
        }
        return f;
      });
      setFiles(updated);
    }
  }, [currentTask]);

  const upload = async (
    list: File[],
    options?: { uploader?: (file: File, context: any) => Promise<FileType>; context?: any },
  ) => {
    FileUploadService.resetStates(list.map((file) => file.name));
    const newFiles = await FileUploadService.upload(
      list.map((file) => {
        return {
          root: file.name,
          file,
        };
      }),
      options,
    );
    setFiles([
      ...files,
      ...newFiles.map(f => {
        return {
          metadata: {
            source: 'pending',
            external_id: f.id,
          },
        };
      }),
    ]);
  };

  const clear = () => setFiles([]);

  return {
    files,
    setFiles,
    upload,
    clear,
  };
};

const pendingFileToMessageFile = (f: AttachedFileType, upToDate: PendingFileType) => {
  return {
    ...f,
    company_id: upToDate.backendFile?.company_id,
    metadata: {
      ...f.metadata,
      source: upToDate.status === 'success' ? 'internal' : 'pending',
      external_id:
        upToDate.status === 'success'
          ? { id: upToDate.backendFile?.id, company_id: upToDate.backendFile?.company_id }
          : upToDate.id,
      mime: upToDate.backendFile?.metadata?.mime,
      size: upToDate.backendFile?.upload_data?.size,
      name: upToDate.backendFile?.metadata?.name,
      thumbnails: upToDate.backendFile?.thumbnails,
    },
  } as AttachedFileType;
};
