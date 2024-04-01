export type DriveFileType = {
  access: 'manage' | 'write' | 'read' | 'none';
  item: {
    last_version_cache: {
      id: string;
      date_added: number;
      file_metadata: {
        external_id: string;
      };
    };
  };
};

export type DriveRequestParams = {
  drive_file_id: string;
  company_id: string;
};

export interface IDriveService {
  get: (params: DriveRequestParams) => Promise<DriveFileType>;
  createVersion: (params: { company_id: string; drive_file_id: string; file_id: string }) => Promise<DriveFileType['item']['last_version_cache']>;
}
