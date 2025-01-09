export type ListUserOptions = {
  userIds?: Array<string>;
};

export type SearchUserOptions = {
  search?: string;
  companyId?: string;
  workspaceId?: string;
  channelId?: string;
};

export type UpdateUser = {
  email: string;
  picture: string;
  first_name: string;
  last_name: string;
};
