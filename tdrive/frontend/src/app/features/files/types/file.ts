import Resumable from '@features/files/utils/resumable';
import { UserType } from '@features/users/types/user';

export type ThumbnailType = {
  width?: number; //Thumbnail width (for images only)
  height?: number; //Thumbnail height (for images only)
  id?: string; //Url to thumbnail (or set it to undefined if no relevant)
  index?: number;
  size?: number;
  mime?: string;
  type?: string;
  url: string;
};

export type AttachedFileMetadataSource = 'internal' | 'drive' | string;

export type AttachedFileType = {
  //Primary key
  id?: string;
  company_id?: string; // optional
  message_id?: string; // optional
  thread_id?: string; // optional

  metadata?: {
    //File information when attached (it can change if edited)
    source?: AttachedFileMetadataSource;
    external_id: string | { company_id: string; id: string } | any;
    name?: string; //Original name
    size?: number; //Original weight
    mime?: string;
    thumbnails?: ThumbnailType[];
  };
};

export type MetaDataType = {
  thumbnails?: ThumbnailType[];
  size?: number;
  name: string;
  mime: string;
  thumbnails_status?: string;
};

export type FileUploadDataObjectType = {
  size: number;
  chunks: number;
};

export type FileType = {
  company_id: string;
  id: string;
  application_id: string;
  created_at: number;
  encryption_key: string;
  metadata: MetaDataType;
  thumbnails: ThumbnailType[];
  updated_at: number;
  upload_data: FileUploadDataObjectType;
  user_id: string;
  user?: UserType;
  parent_id?: string;
};

export type PendingFileRecoilType = {
  id: string;
  status: 'pending' | 'error' | 'success' | 'pause' | 'cancel';
  progress: number; //Between 0 and 1
  file: FileType | null;
  type: string;
  parentId: string | null;
  size: number;
};

/**
 * It could be not only a file, but also a task with creating folders
 */
export type PendingFileType = {
  type: 'file' | 'folder';
  resumable: typeof Resumable | null; //Contain the resumable instance in charge of this file
  uploadTaskId: string;
  id: string;
  status: 'pending' | 'error' | 'success' | 'pause' | 'cancel';
  progress: number; //Between 0 and 1
  originalFile: File | null; //Will be used to get filename, temporary thumbnail
  backendFile: FileType | null; //Will contain the final object returned by API
  lastProgress: number;
  speed: number;
  label: string | null;
  pausable: boolean;
};

export type UploadRootType = {
  id: string;
  size: number;
  uploadedSize: number;
  status: string;
  items: PendingFileRecoilType[];
  isUnknownFormat: boolean;
};

export type UploadRootListType = {
  [key: string]: UploadRootType;
};
