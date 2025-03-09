import { getLogger } from "../../framework";

import type { DatabaseServiceAPI } from "../database/api";
import type { SearchServiceAPI } from "../search/api";

import gr from "../../../../services/global-resolver";
import type Repository from "../database/services/orm/repository/repository";

import User, { TYPE as UserTYPE } from "../../../../services/user/entities/user";
import {
  DriveFile,
  TYPE as DriveFileTYPE,
} from "../../../../services/documents/entities/drive-file";
import { File } from "../../../../services/files/entities/file";
import {
  FileVersion,
  TYPE as FileVersionTYPE,
} from "../../../../services/documents/entities/file-version";
import ExternalUser, {
  TYPE as ExternalUserTYPE,
} from "../../../../services/user/entities/external_user";
import CompanyUser, {
  TYPE as CompanyUserType,
} from "../../../../services/user/entities/company_user";
import {
  MissedDriveFile,
  TYPE as MissedDriveFileTYPE,
} from "../../../../services/documents/entities/missed-drive-file";
import Session from "../../../../services/console/entities/session";
import { fisherYattesShuffleInPlace } from "../../../../utils/arrays";
import { getFilePath } from "../../../../services/files/services";
import Company, { TYPE as CompanyType } from "../../../../services/user/entities/company";

const FileTYPE = "files";

export const adminLogger = getLogger("Admin");

/** Run the `map` function on sets of `batchSize` in `list`, sequentially between batches */
async function runInBatches<T, R>(
  batchSize: number,
  list: readonly T[],
  map: (items: T[]) => Promise<R>,
): Promise<R[]> {
  const listCopy = [...list];
  let batch;
  const result = [] as R[];
  while ((batch = listCopy.splice(0, batchSize)).length) {
    result.push(await map(batch));
  }
  return result;
}

/** Call {@see runInBatches} expecting a boolean result from `map`, return `true` only if empty or all batches returned true */
export async function runInBatchesAreAllTrue<T>(
  batchSize: number,
  list: T[],
  map: (items: T[]) => Promise<boolean[]>,
): Promise<boolean> {
  return (
    await runInBatches(batchSize, list, async results => (await map(results)).every(x => !!x))
  ).every(x => !!x);
}
export type TUserDeletionRepos = Awaited<ReturnType<typeof buildUserDeletionRepositories>>;

/**
 * Create all repositories required for deleting a user
 * @deprecated Do not use this outside of this file, it is exported exclusively for e2e tests
 */
export async function buildUserDeletionRepositories(
  db: DatabaseServiceAPI = gr.database,
  search: SearchServiceAPI = gr.platformServices.search,
) {
  const result = {
    driveFile: await db.getRepository<DriveFile>(DriveFileTYPE, DriveFile),
    file: await db.getRepository<File>(FileTYPE, File),
    fileVersion: await db.getRepository<FileVersion>(FileVersionTYPE, FileVersion),
    missedDriveFile: await db.getRepository<MissedDriveFile>(MissedDriveFileTYPE, MissedDriveFile),
    user: await db.getRepository<User>(UserTYPE, User),
    companyUser: await db.getRepository<CompanyUser>(CompanyUserType, CompanyUser),
    externalUser: await db.getRepository<ExternalUser>(ExternalUserTYPE, ExternalUser),
    company: await db.getRepository<Company>(CompanyType, Company),
    // This one is not typical because it's only valid for remote account type:
    session: gr.services.console.getSessionRepo() as Repository<Session> | null,
    //TODO: checkout what to do with user_online (seen in prod)

    search: {
      driveFile: await search.getRepository<DriveFile>(DriveFileTYPE, DriveFile),
      user: await search.getRepository<User>(UserTYPE, User),
    },
  };
  await Promise.all(Object.values(result).map(item => "init" in item && item.init()));
  return result;
}

export async function findFileOfVersion(
  repos: TUserDeletionRepos,
  version: FileVersion,
): Promise<File> {
  return await repos.file.findOne({ id: version.file_metadata.external_id });
}

/** Return versions, sorted by oldest first, and related DB and S3 entries for a given DriveFile */
export async function loadRawVersionsOfItemForDeletion(
  repos: TUserDeletionRepos,
  item: DriveFile,
  loadStoragePaths = false,
): Promise<
  {
    version: FileVersion;
    file?: File;
    paths?: string[];
  }[]
> {
  return Promise.all(
    (await repos.fileVersion.find({ drive_item_id: item.id }, { sort: { date_added: "asc" } }))
      .getEntities()
      .map(async version => {
        const file = await findFileOfVersion(repos, version);
        if (!loadStoragePaths) return { version, file };
        const paths = file
          ? await gr.platformServices.storage.enumeratePathsForFile(getFilePath(file))
          : [];
        return { version, file, paths };
      }),
  );
}

/**
 * Recursively descends through drive items in a depth-first manner with a random order at each level.
 *
 * @warn No security or filtering is done (e.g., no rights are checked, items in trash are included, etc.).
 *
 * @param {string} parent_id - The ID of the parent drive item (or virtual root) to start the descent from.
 * @param {(item: DriveFile, children: undefined | T[], parents: DriveFile[]) => Promise<T>} map - The mapping function to process each drive item.
 *   - `item`: The current drive item being processed.
 *   - `children`: The results of processing the children of the current drive item, or `undefined` if the item is not a directory.
 *   - `parents`: An array of parent drive items leading to the current item.
 * @returns {Promise<T[]>} A promise that resolves to an array of results produced by the `map` function.
 */
export async function descendDriveItemsDepthFirstRandomOrder<T>(
  repos: TUserDeletionRepos,
  parent_id: string,
  map: (item: DriveFile, children: undefined | T[], parents: readonly DriveFile[]) => Promise<T>,
) {
  async function descend(parent_id: string, parents: readonly DriveFile[]): Promise<T[]> {
    const items = (await repos.driveFile.find({ parent_id })).getEntities();
    fisherYattesShuffleInPlace(items);
    const result = new Array(items.length);
    for (const [index, item] of items.entries()) {
      const children = item.is_directory
        ? await descend(item.id, parents.concat([item]))
        : undefined;
      result[index] = await map(item, children, parents);
    }
    return result;
  }
  return descend(parent_id, []);
}
