import type pino from "pino";
import gr from "../../../../services/global-resolver";
import type User from "../../../../services/user/entities/user";
import AdminServiceAPI from "./service-provider";
import {
  adminLogger,
  buildUserDeletionRepositories,
  descendDriveItemsDepthFirstRandomOrder,
  loadRawVersionsOfItemForDeletion,
  runInBatchesAreAllTrue,
} from "./utils";

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
    batchSize = 5,
  ): Promise<boolean> {
    return await runInBatchesAreAllTrue(batchSize, paths, async paths =>
      Promise.all(
        paths.map(path => {
          try {
            return gr.platformServices.storage.remove("x" + path);
          } catch (err) {
            console.log(err);
            logger.error({ err, path }, "Error deleting storage item");
            return false;
          }
        }),
      ),
    );
  }

  public async deleteUser(user: User): Promise<boolean> {
    /*
    //TODO: NONONO

// todo: do test with wrong s3 delete path to ignore specifically only non existing errors

      Phases:
        - Recurse drive item
          - if file
            - Each version
              - delete all s3
              - then file
              - then the version
            - delete search document
            - delete item
          - if folder - delete if empty
        - search items by creator
        - search files by userid
        - versions ?
        - search leftover s3
        
        // search for file by user id after deletion
        // search s3 for prefix company/userid
    */
    const deleteUserLogger = adminLogger.child({ adminOp: "DeleteUser", user });
    const result = await descendDriveItemsDepthFirstRandomOrder(
      await this.repos,
      "user_" + user.id,
      async (item, children, _parents) => {
        let canDeleteItem = true;
        if (!item.is_directory) {
          const versionsAssets = await loadRawVersionsOfItemForDeletion(
            await this.repos,
            item,
            true,
          );
          for (const { version, file, paths } of versionsAssets) {
            if (paths.length > 0 && !(await this.deleteS3Paths(deleteUserLogger, paths))) {
              deleteUserLogger.error({ paths }, "Failed to delete paths");
              canDeleteItem = false;
            } else {
              try {
                if (file) {
                  const result = await (await this.repos).file.remove(file);
                  if (!result)
                    // No error but nothing deleted, just move on
                    deleteUserLogger.warn({ file, result }, "Failed to delete file");
                }
              } catch (err) {
                canDeleteItem = false;
                deleteUserLogger.error({ err, file }, "Error deleting file");
              }
              if (canDeleteItem && version)
                try {
                  if (version) {
                    const result = await (await this.repos).fileVersion.remove(version);
                    if (!result)
                      // No error but nothing deleted, just move on
                      deleteUserLogger.warn({ version, result }, "Failed to delete version");
                  }
                } catch (err) {
                  canDeleteItem = false;
                  deleteUserLogger.error({ err, version }, "Error deleting version");
                }
            }
          }
        }
        if (canDeleteItem) {
          if (children === undefined || children.every(x => !!x)) {
            if (item.is_directory && children.length == 0)
              deleteUserLogger.warn({ item }, "Deleting empty directory");
            try {
              await (await this.repos).search.driveFile.service.remove([item as never]);
            } catch (err) {
              canDeleteItem = false;
              deleteUserLogger.error({ err, item }, "Error deleting drive item search entry");
            }
            if (canDeleteItem)
              try {
                const result = await (await this.repos).driveFile.remove(item);
                if (!result)
                  // No error but nothing deleted, just move on
                  deleteUserLogger.warn({ item, result }, "Failed to delete drive item");
              } catch (err) {
                canDeleteItem = false;
                deleteUserLogger.error({ err, item }, "Error deleting drive item");
              }
          } else {
            deleteUserLogger.error(
              { item },
              "Not deleting directory as at least one child failed to delete",
            );
            canDeleteItem = false;
          }
        }
        return canDeleteItem;
      },
    );
    if (!result.every(x => !!x)) return false;
    //TODO: error checking and such
    await (await this.repos).search.user.service.remove([user as never]);
    user.delete_process_started_epoch = 0;
    await (await this.repos).user.save(user);
    return true;
  }
}
