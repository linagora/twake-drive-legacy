import { FileRequestParams, FileType, IFileService } from '@/interfaces/file.interface';
import apiService from './api.service';
import loggerService from './logger.service';
import { Stream } from 'stream';
import FormData from 'form-data';

class FileService implements IFileService {
  public get = async (params: FileRequestParams): Promise<FileType> => {
    try {
      const { company_id, file_id } = params;
      const { resource } = await apiService.get<{ resource: FileType }>({
        url: `/internal/services/files/v1/companies/${company_id}/files/${file_id}`,
      });

      return resource;
    } catch (error) {
      loggerService.error('Failed to fetch file metadata: ', error.message);

      return Promise.reject();
    }
  };

  public download = async (params: FileRequestParams): Promise<any> => {
    try {
      const { company_id, file_id } = params;
      const file = await apiService.get({
        url: `/internal/services/files/v1/companies/${company_id}/files/${file_id}/download`,
        responseType: 'stream',
      });

      return file;
    } catch (error) {
      loggerService.error('Failed to download file: ', error.message);
    }
  };

  public save = async (params: FileRequestParams): Promise<{ resource: FileType }> => {
    try {
      const { company_id, file_id, url, create_new } = params;

      if (!url) {
        throw Error('no url found');
      }

      const originalFile = await this.get(params);

      if (!originalFile) {
        throw Error('original file not found');
      }

      const newFile = await apiService.get<Stream>({
        url,
        responseType: 'stream',
      });

      const form = new FormData();

      const nameSplit = (originalFile.metadata.name || '').split('.');
      const filename =
        nameSplit[0].replace(/-[0-9]{8}-[0-9]{4}$/, '') +
        (!create_new ? '.' : `-${new Date().toISOString().split('.')[0].split(':').slice(0, 2).join('').replace(/-/gm, '').split('T').join('-')}.`) +
        nameSplit.slice(1).join('.');
      form.append('file', newFile, {
        filename,
      });

      loggerService.info('Saving file version: ', filename);

      return await apiService.post<any, { resource: FileType }>({
        url: create_new
          ? `/internal/services/files/v1/companies/${company_id}/files?thumbnail_sync=1`
          : `/internal/services/files/v1/companies/${company_id}/files/${file_id}?thumbnail_sync=1`,
        payload: form,
        headers: form.getHeaders(),
      });
    } catch (error) {
      loggerService.error('Failed to save file: ', error.message);
    }
  };
}

export default new FileService();
