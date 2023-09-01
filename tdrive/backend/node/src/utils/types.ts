/**
 * Common types for business services
 */

import { WorkspacePrimaryKey } from "../services/workspaces/entities/workspace";

export type uuid = string;

export type Maybe<T> = T | undefined;

/**
 * User in platform:
 *
 * {
 *    id: "uuid",
 * }
 */
export interface User {
  // unique user id
  id: uuid;
  // unique console user id
  identity_provider_id?: uuid;
  // user email
  email?: string;
  // server request
  server_request?: boolean; //Set to true if request if from the user, can be used to cancel any access restriction
  // application call
  application_id?: string;
  // allow_tracking
  allow_tracking?: boolean;
  // Prevalidated public token access
  public_token_document_id?: string;
}

export const webSocketSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    room: { type: "string" },
    token: { type: "string" },
  },
};

export interface Channel extends Workspace {
  id: string;
}

export enum ChannelType {
  DIRECT = "direct",
}

export interface Workspace {
  company_id: string;
  workspace_id: string;
}

export interface WebsocketMetadata {
  room: string;
  name?: string;
  token?: string;
}

export class ResourceListResponse<T> {
  resources: T[];
  websockets?: ResourceWebsocket[];
  next_page_token?: string;
  total?: number;
}

export class ResourceGetResponse<T> {
  websocket?: ResourceWebsocket;
  resource: T;
}
export class ResourceUpdateResponse<T> {
  websocket?: ResourceWebsocket;
  resource: T;
}
export class ResourceCreateResponse<T> {
  websocket?: ResourceWebsocket;
  resource: T;
}

export class ResourceDeleteResponse {
  status: DeleteStatus;
}

export interface ResourceListQueryParameters extends PaginationQueryParameters {
  search_query?: string;
  mine?: boolean;
}

export declare type DeleteStatus = "success" | "error";
export interface ResourceWebsocket {
  room: string;
  token?: string;
}

export interface ResourceEventsPayload {
  user: User;
  actor?: User;
  resourcesBefore?: User[];
  resourcesAfter?: User[];
  company?: { id: string };
  workspace?: WorkspacePrimaryKey;
}

export interface PaginationQueryParameters {
  // It is offset for MongoDB and pointer to the next page for ScyllaDB
  page_token?: string;
  // Page size
  limit?: string;
  websockets?: boolean;
}

export interface AccessToken {
  time: number;
  expiration: number;
  refresh_expiration: number;
  value: string;
  refresh: string;
  type: "Bearer";
}

export interface JWTObject {
  exp: number;
  type: string;
  iat: number;
  nbf: number;
  sub: string;
  email: string;
  track: boolean;
}

export enum CompanyUserRole {
  member = 1,
  admin = 0,
}
