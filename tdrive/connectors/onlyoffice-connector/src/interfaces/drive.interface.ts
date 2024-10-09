export type DriveFileType = {
  access: 'manage' | 'write' | 'read' | 'none';
  item: {
    name: string;
    last_version_cache: {
      id: string;
      date_added: number;
      file_metadata: {
        external_id: string;
        name?: string;
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
  beginEditingSession: (company_id: string, drive_file_id: string) => Promise<string>;
  addEditingSessionVersion: (editing_session_key: string, url: string) => Promise<void>;
  endEditing: (editing_session_key: string, url: string) => Promise<void>;
}
