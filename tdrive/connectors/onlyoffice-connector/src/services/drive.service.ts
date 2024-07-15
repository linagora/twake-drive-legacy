import { DriveFileType, IDriveService } from '@/interfaces/drive.interface';
import apiService from './api.service';
import logger from '../lib/logger';

/** Client for Twake Drive's APIs dealing with `DriveItem`s, using {@see apiService}
 * to handle authorization
 */
class DriveService implements IDriveService {
  public get = async (params: { company_id: string; drive_file_id: string; user_token?: string }): Promise<DriveFileType> => {
    try {
      const { company_id, drive_file_id } = params;
      const resource = await apiService.get<DriveFileType>({
        url: `/internal/services/documents/v1/companies/${company_id}/item/${drive_file_id}`,
        token: params.user_token,
      });

      return resource;
    } catch (error) {
      logger.error('Failed to fetch file metadata: ', error.stack);

      return Promise.reject();
    }
  };

  public createVersion = async (params: {
    company_id: string;
    drive_file_id: string;
    file_id: string;
  }): Promise<DriveFileType['item']['last_version_cache']> => {
    try {
      const { company_id, drive_file_id, file_id } = params;
      const resource = await apiService.post<{}, DriveFileType['item']['last_version_cache']>({
        url: `/internal/services/documents/v1/companies/${company_id}/item/${drive_file_id}/version`,
        payload: {
          drive_item_id: drive_file_id,
          provider: 'internal',
          file_metadata: {
            external_id: file_id,
            source: 'internal',
          },
        },
      });

      return resource;
    } catch (error) {
      logger.error('Failed to create version: ', error.stack);
      return Promise.reject();
    }
  };
}

export default new DriveService();
