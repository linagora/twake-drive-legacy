import { Type } from "class-transformer";
import { Column, Entity } from "../../../core/platform/services/database/services/orm/decorators";

export const TYPE = "missed_drive_files";

@Entity(TYPE, {
  primaryKey: ["id"],
  type: TYPE,
})
export class MissedDriveFile {
  @Type(() => String)
  @Column("id", "uuid", { generator: "uuid" })
  id: string;

  @Type(() => String)
  @Column("doc_id", "string")
  doc_id: string;

  @Type(() => String)
  @Column("file_id", "string")
  file_id: string;

  @Type(() => Boolean)
  @Column("is_in_trash", "boolean")
  is_in_trash: boolean;

  @Type(() => Boolean)
  @Column("is_from_nextcloud", "boolean")
  is_from_nextcloud: boolean;

  @Type(() => String)
  @Column("name", "string")
  name: string;

  @Type(() => String)
  @Column("description", "string")
  description: string;

  @Type(() => Number)
  @Column("added", "number")
  added: number;

  @Type(() => Number)
  @Column("version", "number")
  version: number;

  @Type(() => Number)
  @Column("size", "number")
  size: number;

  @Type(() => Number)
  @Column("last_modified", "number")
  last_modified: number;

  @Type(() => String)
  @Column("content_keywords", "string")
  user_email: string;

  @Type(() => String)
  @Column("creator", "uuid")
  creator: string;

  @Type(() => String)
  @Column("path", "string")
  path: string;



}
