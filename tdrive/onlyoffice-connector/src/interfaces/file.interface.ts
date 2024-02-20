export type FileType = {
  id: string;
  filename: string;
  company_id: string;
  user_id: string;
  metadata: {
    name: string;
    mime: string;
  };
};

export type FileRequestParams = {
  file_id: string;
  company_id: string;
  url?: string;
  user_id?: string;
  create_new?: boolean;
};

export interface IFileService {
  get: (params: FileRequestParams) => Promise<FileType>;
  download: (params: FileRequestParams) => Promise<any>;
}
