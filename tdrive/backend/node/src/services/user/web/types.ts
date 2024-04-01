import { PaginationQueryParameters } from "../../../utils/types";
import User from "../entities/user";

export interface UserListQueryParameters extends PaginationQueryParameters {
  user_ids?: string;
  include_companies?: boolean;
  search?: string;
  search_company_id?: string;
}

export interface UserParameters {
  /* user id */
  id: string;
}

export interface CompanyUsersParameters {
  /* company id */
  companyId: string;
}

export interface CompanyParameters {
  /* company id */
  id: string;
}

export interface UsersParameters {
  ids?: string;
  companies?: string;
}

export type CompanyUserRole = "owner" | "admin" | "member" | "guest";
export type CompanyUserStatus = "active" | "deactivated" | "invited";

export interface CompanyShort {
  id: string; //Related to console "code"
  name: string;
  logo: string;
}

export interface CompanyUserObject {
  company: CompanyShort;
  role: CompanyUserRole;
  status: CompanyUserStatus;
}

export interface UserObject {
  id: string;
  provider: string;
  provider_id: string;
  email: string;
  username: string;
  is_verified: boolean;
  picture: string;
  first_name: string;
  last_name: string;
  full_name: string;
  created_at: number;
  deleted: boolean;
  status: string; //Single string for the status
  last_activity: number;
  last_seen?: number;
  is_connected?: boolean;
  cache: { companies: string[] };

  //Below is only if this is myself
  preferences?: User["preferences"];
  companies?: CompanyUserObject[];

  // TODO this is temporary, should be deleted
  preference?: User["preferences"];
}

export enum CompanyLimitsEnum {
  CHAT_MESSAGE_HISTORY_LIMIT = "chat:message_history_limit",
  COMPANY_MEMBERS_LIMIT = "company:members_limit", // 100
  COMPANY_GUESTS_LIMIT = "company:guests_limit",
}

export enum CompanyFeaturesEnum {
  CHAT_GUESTS = "chat:guests",
  CHAT_MESSAGE_HISTORY = "chat:message_history",
  CHAT_MULTIPLE_WORKSPACES = "chat:multiple_workspaces",
  CHAT_EDIT_FILES = "chat:edit_files",
  CHAT_UNLIMITED_STORAGE = "chat:unlimited_storage",
  COMPANY_INVITE_MEMBER = "company:invite_member",
  COMPANY_SEARCH_USERS = "company:search_users",
  COMPANY_SHARED_DRIVE = "company:shared_drive",
  COMPANY_DISPLAY_EMAIL = "company:display_email",
  COMPANY_USER_QUOTA = "company:user_quota",
}

export type CompanyFeaturesObject = {
  [CompanyFeaturesEnum.CHAT_GUESTS]?: boolean;
  [CompanyFeaturesEnum.CHAT_MESSAGE_HISTORY]?: boolean;
  [CompanyFeaturesEnum.CHAT_MULTIPLE_WORKSPACES]?: boolean;
  [CompanyFeaturesEnum.CHAT_EDIT_FILES]?: boolean;
  [CompanyFeaturesEnum.CHAT_UNLIMITED_STORAGE]?: boolean;
  [CompanyFeaturesEnum.COMPANY_INVITE_MEMBER]?: boolean;
  [CompanyFeaturesEnum.COMPANY_SEARCH_USERS]?: boolean;
  [CompanyFeaturesEnum.COMPANY_SHARED_DRIVE]?: boolean;
  [CompanyFeaturesEnum.COMPANY_DISPLAY_EMAIL]?: boolean;
  [CompanyFeaturesEnum.COMPANY_USER_QUOTA]?: boolean;
};

export type CompanyLimitsObject = {
  [CompanyLimitsEnum.CHAT_MESSAGE_HISTORY_LIMIT]?: number;
  [CompanyLimitsEnum.COMPANY_MEMBERS_LIMIT]?: number;
  [CompanyLimitsEnum.COMPANY_GUESTS_LIMIT]?: number;
};

export interface CompanyPlanObject {
  name: string;
  limits?: CompanyLimitsObject;
  features?: CompanyFeaturesObject;
}

export interface CompanyStatsObject {
  created_at: number;
  total_members: number;
  total_guests: number;
  total_messages: number;
}

export interface CompanyObject {
  id: string;
  name: string;
  logo: string;
  plan?: CompanyPlanObject;
  stats?: CompanyStatsObject;
  role?: CompanyUserRole;
  status?: CompanyUserStatus;
  identity_provider: string;
  identity_provider_id: string;
}

export interface RegisterDeviceBody {
  resource: RegisterDeviceParams;
}

export interface RegisterDeviceParams {
  type: "FCM";
  value: string;
  version: string;
}

export interface DeregisterDeviceParams {
  value: "string";
}

export interface UserQuota {
  used: number;
  remaining: number;
  total: number;
}
