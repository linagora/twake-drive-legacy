import type pino from "pino";
import gr from "../../../../services/global-resolver";
import type User from "../../../../services/user/entities/user";
import AdminServiceAPI from "./service-provider";
import {
  adminLogger,
  buildUserDeletionRepositories,
  descendDriveItemsDepthFirstRandomOrder,
  findFileOfVersion,
  loadRawVersionsOfItemForDeletion,
  runInBatchesAreAllTrue,
} from "./utils";
import type Repository from "../database/services/orm/repository/repository";
import type { Logger } from "pino";
import type { DriveFile } from "../../../../services/documents/entities/drive-file";
import { getFilePath, getUserPath } from "../../../../services/files/services";
import type { File } from "../../../../services/files/entities/file";
import type { FileVersion } from "../../../../services/documents/entities/file-version";

export default class AdminServiceImpl implements AdminServiceAPI {
  version: "1";

  private _repos;
  private get repos(): ReturnType<typeof buildUserDeletionRepositories> {
    return (this._repos ||= buildUserDeletionRepositories());
  }

  /**
   * Delete all the provided storage path data in batches.
   * Returns `true` if all (or empty) operations returned `true`.
   * Ignores (logs) errors, but cause a return of `false`.
   *
   * @warn No business rules applied, this is unsafe with sync, use only for final deletion.
   */
  private async deleteS3Paths(
    logger: pino.Logger,
    paths: string[],
    batchSize = 10,
  ): Promise<boolean> {
    return await runInBatchesAreAllTrue(batchSize, paths, async paths =>
      Promise.all(
        paths.map(async path => {
          try {
            return await gr.platformServices.storage.remove(
              path,
              undefined,
              undefined,
              "admin:user_account_deletion",
            );
          } catch (err) {
            logger.error({ err, path }, "Error deleting storage item");
            return false;
          }
        }),
      ),
    );
  }

  /** Remove a DB entity, returns false if it threw an error, just logs if no entries were deleted and returns true */
  private async safeDBDelete<T>(
    deleteUserLogger: Logger,
    repo: Repository<T>,
    item: T,
  ): Promise<boolean> {
    try {
      const result = await repo.remove(item);
      if (!result)
        // No error but nothing deleted, just move on
        deleteUserLogger.warn({ item, result }, `Failed to delete ${repo.table}, 0 result count`);
      return true;
    } catch (err) {
      deleteUserLogger.error({ err, item }, `Error deleting ${repo.table}`);
    }
    return false;
  }

  /** Delete all the storage for a File, and if succesful, the File entry from the database */
  private async safeDeleteFile(deleteUserLogger: Logger, file: File): Promise<boolean> {
    const paths = await gr.platformServices.storage.enumeratePathsForFile(getFilePath(file));
    if (paths.length === 0) deleteUserLogger.warn({ file, paths }, "No paths found for File");
    else if (!(await this.deleteS3Paths(deleteUserLogger, paths))) {
      deleteUserLogger.error({ file, paths }, "Failed to delete paths");
      return false;
    }
    return await this.safeDBDelete(deleteUserLogger, (await this.repos).file, file);
  }

  /** Delette version and potential related File with {@link safeDeleteFile} */
  private async safeDeleteVersion(
    deleteUserLogger: Logger,
    version: FileVersion,
    file?: false | File,
  ): Promise<boolean> {
    if (file !== false) {
      file = file || (await findFileOfVersion(await this.repos, version));
      if (file && !(await this.safeDeleteFile(deleteUserLogger, file))) return false;
    }
    return await this.safeDBDelete(deleteUserLogger, (await this.repos).fileVersion, version);
  }

  /**
   * Attempt to delete the DriveFile from the database, including:
   * - related FileVersion and File entities,
   * - all paths in storage
   * - any search document
   *
   * @warn Does not check the DriveFile has no children
   */
  private async safeDeleteSingleDriveFile(
    deleteUserLogger: Logger,
    item: DriveFile,
  ): Promise<boolean> {
    let canDeleteItem = true;
    const versionsAssets = await loadRawVersionsOfItemForDeletion(await this.repos, item, false);
    for (const { version, file } of versionsAssets) {
      if (
        !(await this.safeDeleteVersion(deleteUserLogger, version, item.is_directory ? false : file))
      )
        canDeleteItem = false;
    }
    try {
      await (await this.repos).search.driveFile.service.remove([item as never]);
    } catch (err) {
      // canDeleteItem = false; // Search documents would be filtered out by the missing DriveFile, so continue
      deleteUserLogger.error({ err, item }, "Error deleting drive item search entry");
    }
    if (canDeleteItem)
      if (!(await this.safeDBDelete(deleteUserLogger, (await this.repos).driveFile, item)))
        return false;
    return canDeleteItem;
  }

  /**
   * This call deletes all data related to a user. This means anything uploaded by the
   * user, including shared items, (but not things shared by another with the user).
   *
   * The call is meant to be called repeatedly until it succeeds, and should resist
   * concurrent calls eventually succeeding (though avoid if possible, it's not productive).
   * It should also resist being interrupted by a timeout mid-way, and resuming on a later
   * call.
   *
   * Multiple phases are involved, some must succeed to continue, some failures are ignored
   * as the output should be filtered in other ways.
   *
   * - Depth-first recurse DriveFiles by parent_id
   *    - For files
   *      - For each FileVersion:
   *        - Delete all storage blobs
   *        - Delete related File
   *        - Delete related FileVersion
   *      - Attempt to remove from search index
   *      - Delete DriveFile
   *    - For directories: delete if all children were deleted
   *
   * - Locate `DriveFile`s, `FileVersion`s then `File`s that have the creator_id
   *   set to the user being deleted, and delete them individually in a similar
   *   way to above
   * - Delete company users and external users
   * - Set user's `delete_process_started_epoch` field to 0 if succesful
   *
   * @param user {@link User} entity to delete
   * @returns `true` if the user was completely deleted
   */
  public async deleteUser(user: User): Promise<boolean> {
    const deleteUserLogger = adminLogger.child({ adminOp: "DeleteUser", user: user.id });

    const result = await descendDriveItemsDepthFirstRandomOrder(
      await this.repos,
      "user_" + user.id,
      async (item, children, _parents) => {
        if (children === undefined || children.every(x => !!x)) {
          if (item.is_directory && children.length == 0)
            deleteUserLogger.warn({ item }, "Deleting empty directory");
          if (!(await this.safeDeleteSingleDriveFile(deleteUserLogger, item))) return false;
        } else {
          deleteUserLogger.error(
            { item },
            "Not deleting directory as at least one child failed to delete",
          );
          return false;
        }
        return true;
      },
    );

    // Stop if deleting root DriveFiles didn't succeed
    if (!result.every(x => !!x)) return false;

    // Stray items out of parent_id etc tree attached to the user in other ways
    let canContinueDeleting = true;

    const driveItemsByCreator = (
      await (await this.repos).driveFile.find({ creator: user.id })
    ).getEntities();
    deleteUserLogger.info(
      { canContinueDeleting, driveItemsByCreator: driveItemsByCreator.length },
      "Stray driveItemsByCreator",
    );
    for (const creatorDriveFile of driveItemsByCreator)
      if (!(await this.safeDeleteSingleDriveFile(deleteUserLogger, creatorDriveFile)))
        canContinueDeleting = false;
    if (!canContinueDeleting) return false;

    const versionsByCreator = (
      await (await this.repos).fileVersion.find({ creator_id: user.id })
    ).getEntities();
    deleteUserLogger.info(
      { canContinueDeleting, versionsByCreator: versionsByCreator.length },
      "Stray versionsByCreator",
    );
    for (const creatorVersion of versionsByCreator)
      if (!(await this.safeDeleteVersion(deleteUserLogger, creatorVersion)))
        canContinueDeleting = false;
    if (!canContinueDeleting) return false;
    deleteUserLogger.info(
      { canContinueDeleting, versionsByCreator: versionsByCreator.length },
      "Stray versionsByCreator",
    );

    const filesByCreator = (await (await this.repos).file.find({ user_id: user.id })).getEntities();
    deleteUserLogger.info(
      { canContinueDeleting, filesByCreator: filesByCreator.length },
      "Stray filesByCreator",
    );
    for (const creatorFile of filesByCreator)
      if (!(await this.safeDeleteFile(deleteUserLogger, creatorFile))) canContinueDeleting = false;
    if (!canContinueDeleting) return false;

    // Remove stray S3 data by prefix folder, then de-associate from company if ok
    const companyUsers = (
      await (await this.repos).companyUser.find({ user_id: user.id })
    ).getEntities();
    deleteUserLogger.info(
      { canContinueDeleting, companyUsers: companyUsers.length },
      "companyUsers",
    );
    for (const companyUser of companyUsers) {
      const paths = await gr.platformServices.storage.enumeratePathsForFile(
        getUserPath(user.id, companyUser.group_id),
      );
      if (!(await this.deleteS3Paths(deleteUserLogger, paths))) canContinueDeleting = false;
      else if (
        !(await this.safeDBDelete(deleteUserLogger, (await this.repos).companyUser, companyUser))
      ) {
        deleteUserLogger.warn({ companyUser }, "Failed to delete database entry");
        canContinueDeleting = false;
      }
    }

    const externalUsers = (
      await (await this.repos).externalUser.find({ user_id: user.id })
    ).getEntities();
    deleteUserLogger.info(
      { canContinueDeleting, externalUsers: externalUsers.length },
      "externalUsers",
    );
    for (const externalUser of externalUsers)
      if (
        !(await this.safeDBDelete(deleteUserLogger, (await this.repos).externalUser, externalUser))
      )
        canContinueDeleting = false;

    await (await this.repos).search.user.service.remove([user as never]);

    if (canContinueDeleting) {
      const latestUser = await (await this.repos).user.findOne({ id: user.id });
      deleteUserLogger.info("User deletion complete, zeroing delete_process_started_epoch");
      latestUser.delete_process_started_epoch = 0;
      await (await this.repos).user.save(latestUser);
    }

    return canContinueDeleting;
  }
}
