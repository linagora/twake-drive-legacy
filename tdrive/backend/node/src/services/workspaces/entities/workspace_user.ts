import { merge } from "lodash";
import { Column, Entity } from "../../../core/platform/services/database/services/orm/decorators";
import { WorkspaceUserRole } from "../types";

export const TYPE = "workspace_user";

/**
 * Link between a workspace and a user
 */
@Entity(TYPE, {
  primaryKey: [["workspace_id"], "user_id", "id"],
  type: TYPE,
})
export default class WorkspaceUser {
  @Column("workspace_id", "timeuuid")
  workspaceId: string;

  @Column("user_id", "timeuuid")
  userId: string;

  @Column("id", "timeuuid")
  id: string;

  @Column("role", "string")
  role: WorkspaceUserRole = "member"; //Relative to workspace only (not relative to company)

  @Column("date_added", "number")
  dateAdded: number;

  @Column("last_access", "number")
  lastAccess: number;
}

export type WorkspaceUserPrimaryKey = Partial<Pick<WorkspaceUser, "workspaceId" | "userId">>;

export function getInstance(
  workspaceUser: Partial<WorkspaceUser> & WorkspaceUserPrimaryKey,
): WorkspaceUser {
  return merge(new WorkspaceUser(), workspaceUser);
}

export function formatWorkspaceUser(workspaceUser: WorkspaceUser): WorkspaceUser {
  if (!workspaceUser) return workspaceUser;
  workspaceUser.role = workspaceUser.role || "member";
  return workspaceUser;
}
