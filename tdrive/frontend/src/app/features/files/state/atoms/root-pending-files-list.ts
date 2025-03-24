import { atom } from 'recoil';
import { PendingFileRecoilType } from '@features/files/types/file';

export const RootPendingFilesListState = atom<
  | {
      [key: string]: {
        id: string;
        size: number;
        uploadedSize: number;
        status: string;
        items: PendingFileRecoilType[];
        isFileRoot: boolean;
      };
    }
  | undefined
>({
  key: 'RootPendingFilesListState',
  default: {},
});
