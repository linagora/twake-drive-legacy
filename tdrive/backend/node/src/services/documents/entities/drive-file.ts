import { Type } from "class-transformer";
import { Column, Entity } from "../../../core/platform/services/database/services/orm/decorators";
import { DriveFileAccessLevel, publicAccessLevel } from "../types";
import { FileVersion } from "./file-version";
import search from "./drive-file.search";

export const TYPE = "drive_files";
export type DriveScope = "personal" | "shared";
/**
 * This represents an item in the file hierarchy.
 *
 * DriveFile s do not have a notion of owner, only a creator. The `creator`
 * is used to locate the root files. The `parent_id` fields then form the
 * hierarchy.
 *
 * The `is_in_trash` field must be checked when enumerating as DrifeFiles with
 * this field set are roots inside the trash folder. Only the root DriveFiles
 * that were moved to trash have this set, items below them, while also in the
 * trash, do not have this field set.
 *
 * The `parent_id` can point to the `id` of another `DriveFile`, or one
 * of the named entries:
 *   - `"user_$userid"`: Root of the personal "My Drive" (and Trash) folder of the user in the string.
 *                       Usually this is assumed to be the creator, there is no official way
 *                       of extracting the user id from the `parent_id`.
 *   - `"root"`: Root of the creator's company "Shared Drive" feature
 *   - The following virtual values never appear in the stored `parent_id` field but are used
 *     in queries and URLs etc:
 *     - `"trash"`: used to query items at the root of the creator with `is_in_trash == true`,
 *        if `scope == "personal"`, otherwise the trash of the shared drive
 *     - `"trash_$userid"`: Trash folder for a given user (same note as `"user_$userid"`)
 *     - `"shared_with_me"`: for the feature of the same name
 */
@Entity(TYPE, {
  globalIndexes: [
    ["company_id", "parent_id"],
    ["company_id", "is_in_trash"],
  ],
  primaryKey: [["company_id"], "id"],
  type: TYPE,
  search,
})
export class DriveFile {
  @Type(() => String)
  @Column("company_id", "uuid")
  company_id: string;

  @Type(() => String)
  @Column("id", "uuid", { generator: "uuid" })
  id: string;

  @Type(() => String)
  @Column("parent_id", "string")
  parent_id: string;

  @Type(() => Boolean)
  @Column("is_in_trash", "boolean")
  is_in_trash: boolean;

  @Type(() => Boolean)
  @Column("is_directory", "boolean")
  is_directory: boolean;

  @Type(() => String)
  @Column("name", "string")
  name: string;

  @Type(() => String)
  @Column("extension", "string")
  extension: string;

  @Type(() => String)
  @Column("description", "string")
  description: string;

  @Column("tags", "encoded_json")
  tags: string[];

  @Type(() => Number)
  @Column("added", "number")
  added: number;

  @Type(() => Number)
  @Column("last_modified", "number")
  last_modified: number;

  @Column("access_info", "encoded_json")
  access_info: AccessInformation;

  @Type(() => String)
  @Column("content_keywords", "string")
  content_keywords: string;

  @Type(() => String)
  @Column("creator", "uuid")
  creator: string;

  @Type(() => Number)
  @Column("size", "number")
  size: number;

  @Column("last_version_cache", "encoded_json")
  last_version_cache: Partial<FileVersion>;

  @Type(() => String)
  @Column("scope", "string")
  scope: DriveScope;
}

export type AccessInformation = {
  public?: {
    token: string;
    password: string;
    expiration: number;
    level: publicAccessLevel;
  };
  entities: AuthEntity[];
};

export type AuthEntity = {
  type: "user" | "channel" | "company" | "folder";
  id: string | "parent";
  level: publicAccessLevel | DriveFileAccessLevel;
  grantor: string;
};
