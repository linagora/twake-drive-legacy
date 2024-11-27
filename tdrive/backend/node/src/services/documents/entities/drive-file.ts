import { Type } from "class-transformer";
import { randomUUID } from "crypto";
import { Column, Entity } from "../../../core/platform/services/database/services/orm/decorators";
import { DriveFileAccessLevel, publicAccessLevel } from "../types";
import { FileVersion } from "./file-version";
import search from "./drive-file.search";
import * as UUIDTools from "../../../utils/uuid";

export const TYPE = "drive_files";
export type DriveScope = "personal" | "shared";
export type AVStatusSafe = "uploaded" | "scanning" | "safe";
export type AVStatusUnsafe = "scan_failed" | "malicious" | "skipped";
export type AVStatus = AVStatusSafe | AVStatusUnsafe;

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
 *
 * The `status` field represents the current scan status of the file,
 * which can be one of the following:
 * - `"uploaded"`: The file has been uploaded but not yet scanned.
 * - `"scanning"`: The file is currently being scanned.
 * - `"scan_failed"`: The scan failed, possibly due to an error.
 * - `"safe"`: The file has been scanned and marked as safe.
 * - `"malicious"`: The file has been marked as potentially malicious.
 * - `"skipped"`: The file scan was skipped (file size too big).
 */
@Entity(TYPE, {
  globalIndexes: [
    ["company_id", "parent_id"],
    ["company_id", "is_in_trash"],

    // Needs to be globally unique (no `company_id`) because it's the only key that OnlyOffice
    // will return to us to identify the document being edited. Convenient for other plugins too.
    ["editing_session_key"],
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

  /**
   * If this field is non-null, then an editing session is in progress (probably in OnlyOffice).
   * Use {@see EditingSessionKeyFormat} to generate and interpret it.
   * Values should ensure that sorting lexicographically is chronological (assuming perfect clocks everywhere),
   * and that the application, company and user that started the edit session are retrievable.
   * It is not encrypted.
   */
  @Type(() => String)
  @Column("editing_session_key", "string")
  editing_session_key: string;

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

  @Type(() => String)
  @Column("av_status", "string")
  av_status: AVStatus;
}

const OnlyOfficeSafeDocKeyBase64 = {
  // base64 uses `+/`, but base64url uses `-_` instead. Both use `=` as padding,
  // which conflicts with EditingSessionKeyFormat so using `.` instead.
  fromBuffer(buffer: Buffer) {
    return buffer.toString("base64url").replace(/=/g, ".");
  },
  toBuffer(base64: string) {
    return Buffer.from(base64.replace(/\./g, "="), "base64url");
  },
};

function checkFieldValue(field: string, value: string, required: boolean = true) {
  if (!required && !value) return;
  if (!/^[0-9a-zA-Z_-]+$/m.test(value))
    throw new Error(
      `Invalid ${field} value (${JSON.stringify(
        value,
      )}). Must be short and only alpha numeric or '_' and '-'`,
    );
}
/**
 * Reference implementation for generating then parsing the {@link DriveFile.editing_session_key} field.
 *
 * Fields should be explicit, `instanceId` is for the case when we have multiple
 * clients
 */
export const EditingSessionKeyFormat = {
  // OnlyOffice key limits: 128 chars, [0-9a-zA-Z.=_-]
  // See https://api.onlyoffice.com/editors/config/document#key
  // This is specific to it, but the constraint seems strict enough
  // that any other system needing such a unique identifier would find
  // this compatible. This value must be ensured to be the strictest
  // common denominator to all plugin/interop systems. Plugins that
  // require something even stricter have the option of maintaining
  // a look up table to an acceptable value.
  generate(
    applicationId: string,
    instanceId: string,
    companyId: string,
    userId: string,
    overrideTimeStamp?: Date,
  ) {
    checkFieldValue("applicationId", applicationId);
    checkFieldValue("instanceId", instanceId, false);
    const isoUTCDateNoSpecialCharsNoMS = (overrideTimeStamp ?? new Date())
      .toISOString()
      .replace(/\..+$/, "")
      .replace(/[ZT:-]/g, "");
    const userIdBuffer = UUIDTools.bufferFromUUIDString(userId) as unknown as Uint8Array;
    const companyIdBuffer = UUIDTools.bufferFromUUIDString(companyId) as unknown as Uint8Array;
    const entropyBuffer = UUIDTools.bufferFromUUIDString(randomUUID()) as unknown as Uint8Array;
    const idsString = OnlyOfficeSafeDocKeyBase64.fromBuffer(
      Buffer.concat([companyIdBuffer, userIdBuffer, entropyBuffer]),
    );
    const newKey = [isoUTCDateNoSpecialCharsNoMS, applicationId, instanceId, idsString].join("=");
    if (newKey.length > 128 || !/^[0-9a-zA-Z=_-]+$/m.test(newKey))
      throw new Error(
        `Invalid generated editingSessionKey (${JSON.stringify(
          newKey,
        )}) string. Must be <128 chars, and only contain [0-9a-zA-z=_-]`,
      );
    return newKey;
  },

  parse(editingSessionKey: string) {
    const parts = editingSessionKey.split("=");
    const expectedParts = 4;
    if (parts.length !== expectedParts)
      throw new Error(
        `Invalid editingSessionKey (${JSON.stringify(
          editingSessionKey,
        )}). Expected ${expectedParts} parts`,
      );
    const [timestampStr, applicationId, instanceId, idsOOBase64String] = parts;
    const timestampMatch = timestampStr.match(
      /^(?<year>\d{4})(?<month>\d\d)(?<day>\d\d)(?<hour>\d\d)(?<minute>\d\d)(?<second>\d\d)$/,
    );
    if (!timestampMatch)
      throw new Error(
        `Invalid editingSessionKey (${JSON.stringify(
          editingSessionKey,
        )}). Didn't start with valid timestamp`,
      );
    const { year, month, day, hour, minute, second } = timestampMatch.groups!;
    const idsBuffer = OnlyOfficeSafeDocKeyBase64.toBuffer(idsOOBase64String);
    const companyId = UUIDTools.formattedUUIDInBufferArray(idsBuffer, 0);
    const userId = UUIDTools.formattedUUIDInBufferArray(idsBuffer, 1);
    return {
      timestamp: new Date(
        Date.parse(`${[year, month, day].join("-")}T${[hour, minute, second].join(":")}Z`),
      ),
      applicationId,
      instanceId,
      companyId,
      userId,
    };
  },
};

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
