import { merge } from "lodash";
import { Column, Entity } from "../../../core/platform/services/database/services/orm/decorators";
import { CompanyUserRole } from "../web/types";

export const TYPE = "group_user";

/**
 * Link between a company and a user
 */
@Entity(TYPE, {
  primaryKey: [["user_id"], "group_id", "id"],
  type: TYPE,
})
export default class CompanyUser {
  @Column("group_id", "timeuuid")
  group_id: string;

  @Column("user_id", "timeuuid")
  user_id: string;

  @Column("id", "timeuuid")
  id: string;

  @Column("role", "string")
  role: CompanyUserRole = "member";

  @Column("applications", "json")
  applications: string[] = [];

  @Column("nb_workspace", "number")
  nbWorkspaces: number;

  @Column("date_added", "number")
  dateAdded: number;

  @Column("last_update_day", "number")
  lastUpdateDay: number;

  /**
   * 0: member,
   * 1, 2, 3: admin,
   */
  @Column("level", "number")
  level: number; //Depreciated

  @Column("is_externe", "tdrive_boolean")
  isExterne: boolean; //Depreciated

  @Column("did_connect_today", "tdrive_boolean")
  didConnectToday: boolean; //Depreciated

  @Column("app_used_today", "json")
  appUsedToday: Array<string>; //Depreciated
}

export type CompanyUserPrimaryKey = Partial<Pick<CompanyUser, "group_id" | "user_id">>;

export function getInstance(
  companyUser: Partial<CompanyUser> & CompanyUserPrimaryKey,
): CompanyUser {
  return merge(new CompanyUser(), companyUser);
}
