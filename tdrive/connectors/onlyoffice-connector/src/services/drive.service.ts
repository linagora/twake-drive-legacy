import { DriveFileType, IDriveService } from '@/interfaces/drive.interface';
import apiService from './api.service';
import logger from '../lib/logger';
import * as Utils from '../utils';
import { Stream } from 'stream';
import FormData from 'form-data';
import { INSTANCE_ID } from '@/config';

/** Thrown when Twake Drive returns a 404 for a key */
export class UnknownKeyInDriveError extends Error {}

const makeTwakeDriveApiUrl = (paths: string[], params?: Utils.QueryParams) => Utils.joinURL(['/internal/services/documents/v1', ...paths], params);
const makeNonEditingSessionItemUrl = (company_id: string, drive_file_id: string, paths: string[] = [], params?: Utils.QueryParams) =>
  makeTwakeDriveApiUrl(['companies', company_id, 'item', drive_file_id, ...paths], params);
const makeEditingSessionItemUrl = (editing_session: string, params?: Utils.QueryParams) =>
  makeTwakeDriveApiUrl(['editing_session', editing_session], params);

/**
 * Client for Twake Drive's APIs dealing with `DriveItem`s, using {@see apiService}
 * to handle authorization
 */
class DriveService implements IDriveService {
  public get = async (params: { company_id: string; drive_file_id: string; user_token?: string }): Promise<DriveFileType> => {
    try {
      const { company_id, drive_file_id } = params;
      const resource = await apiService.get<DriveFileType>({
        url: makeNonEditingSessionItemUrl(company_id, drive_file_id),
        token: params.user_token,
      });

      return resource;
    } catch (error) {
      logger.error('Failed to fetch file metadata: ', error.stack);

      return Promise.reject();
    }
  };

  public update = async (params: {
    company_id: string;
    drive_file_id: string;
    changes: Partial<DriveFileType['item']>;
    completeResult?: boolean;
  }): Promise<(typeof params)['changes']> => {
    try {
      const { company_id, drive_file_id } = params;
      const resource = await apiService.post<(typeof params)['changes'], ReturnType<DriveService['update']>>({
        url: makeNonEditingSessionItemUrl(company_id, drive_file_id),
        payload: params.changes,
      });
      if (params.completeResult) return resource;
      const result = {};
      Object.keys(params.changes).forEach(k => (result[k] = resource[k]));
      return result;
    } catch (error) {
      logger.error('Failed to update file metadata: ', error.stack);
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
      return await apiService.post<{}, DriveFileType['item']['last_version_cache']>({
        url: makeNonEditingSessionItemUrl(company_id, drive_file_id, ['version']),
        payload: {
          drive_item_id: drive_file_id,
          provider: 'internal',
          file_metadata: {
            external_id: file_id,
            source: 'internal',
          },
        },
      });
    } catch (error) {
      logger.error('Failed to create version: ', error.stack);
      return Promise.reject();
    }
  };

  public async beginEditingSession(company_id: string, drive_file_id: string, user_token?: string) {
    try {
      const resource = await apiService.post<{}, { editingSessionKey: string }>({
        url: makeNonEditingSessionItemUrl(company_id, drive_file_id, ['editing_session']),
        token: user_token,
        payload: {
          editorApplicationId: 'tdrive_onlyoffice',
          appInstanceId: INSTANCE_ID ?? '',
        },
      });
      if (resource?.editingSessionKey) {
        return resource.editingSessionKey;
      } else {
        throw new Error(`Failed to obtain editing session key, response: ${JSON.stringify(resource)}`);
      }
    } catch (error) {
      logger.error('Failed to begin editing session: ', error.stack);
      throw error;
    }
  }

  public async cancelEditing(editing_session_key: string) {
    try {
      await apiService.delete<{}>({
        url: makeEditingSessionItemUrl(editing_session_key),
      });
    } catch (error) {
      logger.error('Failed to begin editing session: ', error.stack);
      throw error;
      //TODO make monitoring for such kind of errors
    }
  }

  public async addEditingSessionVersion(editing_session_key: string, url: string, userId?: string) {
    return this.updateEditing(editing_session_key, url, true, userId);
  }

  public async endEditing(editing_session_key: string, url: string, userId?: string) {
    return this.updateEditing(editing_session_key, url, false, userId);
  }

  private async updateEditing(editing_session_key: string, url: string, keepEditing: boolean, userId?: string) {
    try {
      if (!url) {
        throw Error('no url found');
      }

      const newFile = await apiService.get<Stream>({
        url,
        responseType: 'stream',
      });

      const form = new FormData();

      form.append('file', newFile);

      logger.info(`Saving file version to Twake Drive`, { editing_session_key, url });

      await apiService.post({
        url: makeEditingSessionItemUrl(editing_session_key, {
          keepEditing: keepEditing ? 'true' : null,
          userId,
        }),
        payload: form,
        headers: form.getHeaders(),
      });
    } catch (error) {
      if (error.response?.status === 404) {
        logger.error('Forgotten OO document that Twake Drive doesnt know the key of.', { editing_session_key, url });
        throw new UnknownKeyInDriveError(`Unknown key ${JSON.stringify(editing_session_key)}`);
        //TODO: Distinguish this case from a long disconnected browser tab waking up
        //TODO make monitoring for such kind of errors
      } else {
        logger.error('Failed to end editing session: ', error.stack);
        throw error;
      }
    }
  }
}

export default new DriveService();
