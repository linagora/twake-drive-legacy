import { PendingFileRecoilType } from '@features/files/types/file';

export const isPendingFileStatusPause = (status: PendingFileRecoilType['status']): boolean => {
  return status === 'pause';
};

export const isPendingFileStatusError = (status: PendingFileRecoilType['status']): boolean => {
  return status === 'error';
};

export const isPendingFileStatusCancel = (status: PendingFileRecoilType['status']): boolean => {
  return status === 'cancel';
};

export const isPendingFileStatusPending = (status: PendingFileRecoilType['status']): boolean => {
  return status === 'pending';
};

export const isPendingFileStatusSuccess = (status: PendingFileRecoilType['status']): boolean => {
  return status === 'success';
};
