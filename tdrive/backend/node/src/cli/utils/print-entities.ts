import type { EntityTarget } from "../../core/platform/services/search/api";
import gr from "../../services/global-resolver";

import User, { TYPE as UserTYPE } from "../../services/user/entities/user";
import { DriveFile, TYPE as DriveFileTYPE } from "../../services/documents/entities/drive-file";
import { File } from "../../services/files/entities/file";
import {
  FileVersion,
  TYPE as FileVersionTYPE,
} from "../../services/documents/entities/file-version";
import CompanyUser, { TYPE as CompanyUserTYPE } from "../../services/user/entities/company_user";
import {
  MissedDriveFile,
  TYPE as MissedDriveFileTYPE,
} from "../../services/documents/entities/missed-drive-file";
import Company, { TYPE as CompanyTYPE } from "../../services/user/entities/company";

const FileTYPE = "files";

/** Fake entity to represent S3 path entries as similar resources */
interface S3Object {
  /** id of the File */
  id: string;
  /** path in bucket of the file */
  path: string;
}

const epochToISO = epoch => (epoch ? new Date(epoch).toISOString() : "<null date>");
export const EntityKindToString = {
  user: (entity: User): string => `🤺 ${entity.email_canonical}`,
  // extUser: (entity: ExternalUser): string => `🤺 ${entity.user_id} <-> 🌍 ${entity.external_id}`,
  compUser: (entity: CompanyUser): string => `🤺 ${entity.user_id} <-> 🏦 ${entity.group_id}`,
  // session: (entity: Session): string => `🤺 ${entity.sub} <-> 🏦 ${entity.company_id}`,
  company: (entity: Company): string => `🏦 ${entity.name || entity.displayName}`,
  item: (entity: DriveFile): string =>
    `${entity.is_in_trash ? "🗑️ " : ""}${entity.is_directory ? "📁" : "📄"}${
      entity.scope != "personal" ? "🏢 " : ""
    } ${entity.name}`,
  version: (entity: FileVersion): string =>
    `🕰️ ${epochToISO(entity.date_added)} - ${entity.file_size}`,
  file: (entity: File): string => `💿 ${epochToISO(entity.updated_at)}`,
  s3: (entity: S3Object): string => `☁️ ${entity.path}`,
  missed: (entity: MissedDriveFile): string =>
    `😭 ${entity.is_in_trash ? "🗑️ " : ""} ${entity.name}`,
};

const makeEntityKind = <T>(
  kind: keyof typeof EntityKindToString,
  db?: { entity: EntityTarget<T>; type: string },
) => {
  const headerToString = EntityKindToString[kind];
  return {
    kind,
    headerOf: headerToString,
    db: db
      ? {
          getRepository: () => gr.database.getRepository<T>(db.type, db.entity),
          ...db,
        }
      : undefined,
  };
};

export type TEntityNames = keyof typeof Entities;
export const Entities = {
  User: makeEntityKind<User>("user", { entity: User, type: UserTYPE }),
  DriveFile: makeEntityKind<DriveFile>("item", { entity: DriveFile, type: DriveFileTYPE }),
  File: makeEntityKind<File>("file", { entity: File, type: FileTYPE }),
  FileVersion: makeEntityKind<FileVersion>("version", {
    entity: FileVersion,
    type: FileVersionTYPE,
  }),
  // ExternalUser: makeEntityKind<ExternalUser>("extUser", {
  //   entity: ExternalUser,
  //   type: ExternalUserTYPE,
  // }),
  CompanyUser: makeEntityKind<CompanyUser>("compUser", {
    entity: CompanyUser,
    type: CompanyUserTYPE,
  }),
  MissedDriveFile: makeEntityKind<MissedDriveFile>("missed", {
    entity: MissedDriveFile,
    type: MissedDriveFileTYPE,
  }),
  Company: makeEntityKind<Company>("company", { entity: Company, type: CompanyTYPE }),
  // Session: makeEntityKind<Session>("session", { entity: Session, type: SessionTYPE }),
  $S3: makeEntityKind<S3Object>("s3"),
};

export const EntityByKind = Object.fromEntries(
  Object.entries(Entities).map(([_, def]) => [def.kind, def]),
);
