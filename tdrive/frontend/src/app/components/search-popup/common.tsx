import { DriveApiClient } from '@features/drive/api-client/api-client';
import { DriveItem } from '@features/drive/types';


export const onDriveItemDownloadClick = async (driveItem: DriveItem) => {
  const url = await DriveApiClient.getDownloadUrl(driveItem.company_id, driveItem.id);
  url && (window.location.href = url);
};
