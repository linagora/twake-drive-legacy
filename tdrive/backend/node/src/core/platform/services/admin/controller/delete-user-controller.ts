import gr from "../../../../../services/global-resolver";

import type { ExecutionContext } from "../../../../platform/framework/api/crud-service";

import { adminLogger, buildUserDeletionRepositories } from "../utils";

export class AdminDeleteUserController {
  private _repos: Awaited<ReturnType<typeof buildUserDeletionRepositories>>;
  private async getRepos() {
    if (!this._repos)
      this._repos = await buildUserDeletionRepositories(gr.database, gr.platformServices.search);
    return this._repos;
  }

  /** Begin or forward the deletion process of a user, if `deleteData` is false, only anonymises the user entry */
  async deleteUser(userId: string, deleteData: boolean): Promise<"failed" | "deleting" | "done"> {
    try {
      if (
        await gr.services.users.anonymizeAndDelete(
          { id: userId },
          {
            user: { server_request: true },
          } as unknown as ExecutionContext,
          deleteData,
        )
      )
        return "done";
      const existingUser = await (await this.getRepos()).user.findOne({ id: userId });
      if (existingUser?.deleted) {
        if (existingUser.delete_process_started_epoch > 0) return "deleting";
      }
    } catch (err) {
      adminLogger.error({ err, userId }, "User deletion error");
      return "failed";
    }
    return "done";
  }

  /** Get an array of 2 item arrays with `[ user IDs, delete_process_started_epoch ]` that are incompletely deleted */
  async listUsersPendingDeletion() {
    const users = (
      await (await this.getRepos()).user.find({}, { $gt: [["delete_process_started_epoch", 0]] })
    ).getEntities();
    return users.map(({ id, delete_process_started_epoch }) => [id, delete_process_started_epoch]);
  }
}
