import { ExecutionContext, Paginable } from "../../core/platform/framework/api/crud-service";
import { DriveFile } from "./entities/drive-file";
import { FileVersion } from "./entities/file-version";
import { SortType } from "../../core/platform/services/search/api";

export interface CompanyExecutionContext extends ExecutionContext {
  company: { id: string };
}

export type DriveExecutionContext = CompanyExecutionContext;

export type RequestParams = {
  company_id: string;
};

export type ItemRequestParams = RequestParams & {
  id: string;
};

export type ItemRequestByEditingSessionKeyParams = RequestParams & {
  editing_session_key: string;
};

export type DriveItemDetails = {
  path: DriveFile[];
  item?: DriveFile;
  versions?: FileVersion[];
  children: DriveFile[];
  access: DriveFileAccessLevel | "none";
};

export type BrowseDetails = DriveItemDetails & { nextPage: Paginable };

export type DriveFileAccessLevel = "read" | "write" | "manage";
export type publicAccessLevel = "write" | "read" | "none" | "manage";

export type RootType = "root";
export type TrashType = "trash";
export type SharedWithMeType = "shared_with_me";

export type DownloadZipBodyRequest = {
  items: string[];
};

export type SearchDocumentsOptions = {
  search?: string;
  company_id?: string;
  creator?: string;
  added_gt?: number;
  added_lt?: number;
  mime_type?: Array<string>;
  last_modified_gt?: number;
  last_modified_lt?: number;
  sort?: SortType;
  view?: string;
  fields?: string[];
  onlyDirectlyShared?: boolean;
  onlyUploadedNotByMe?: boolean;
  pagination?: Paginable;
};

export type SearchDocumentsBody = {
  search?: string;
  company_id?: string;
  creator?: string;
  added_gt?: number;
  added_lt?: number;
  mime_type?: [string];
  last_modified_gt?: number;
  last_modified_lt?: number;
  sort?: SortType;
  view?: string;
  fields?: string[];
};

export type DocumentsMessageQueueRequest = {
  item: DriveFile;
  version: FileVersion;
  context: CompanyExecutionContext;
};

export type DocumentsMessageQueueCallback = {
  item: DriveFile;
  content_keywords: string;
};

export type exportKeywordPayload = {
  file_id: string;
  company_id: string;
};

export type DriveTdriveTab = {
  company_id: string;
  tab_id: string;
  channel_id: string;
  item_id: string;
  level: "read" | "write";
};

export enum DocumentEvents {
  DOCUMENT_SAHRED = "document_shared",
  DOCUMENT_VERSION_UPDATED = "document_version_updated",
}

export type NotificationPayloadType = {
  context: CompanyExecutionContext;
  item: DriveFile;
  notificationEmitter: string;
  notificationReceiver: string;
};
