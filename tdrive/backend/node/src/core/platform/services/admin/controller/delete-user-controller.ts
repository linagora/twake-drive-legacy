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

  async markToDelete(
    userId: string,
  ): Promise<{ status: "failed" | "deleting" | "done"; userId?: string }> {
    try {
      await gr.services.console.getClient().userWasDeletedForceLogout(userId);
      await gr.services.users.markToDeleted({ id: userId });
    } catch (err) {
      adminLogger.error({ err, userId }, "[DELETE USER] Error dustin updating user ");
      return {
        status: "failed",
        userId,
      };
    }
    return {
      status: "done",
      userId,
    };
  }

  /** Begin or forward the deletion process of a user, if `deleteData` is false, only anonymises the user entry */
  async deleteUser(
    userId: string,
    deleteData: boolean,
  ): Promise<{ status: "failed" | "deleting" | "done"; userId?: string }> {
    try {
      const data = await gr.services.users.anonymizeAndDelete(
        { id: userId },
        {
          user: { server_request: true },
        } as unknown as ExecutionContext,
        deleteData,
      );
      adminLogger.info({ data }, "Anonymize and delete data");

      if (data.isDeleted)
        return {
          status: "done",
          userId: data.userId,
        };
      const existingUser = await (await this.getRepos()).user.findOne({ id: userId });
      adminLogger.info({ existingUser }, "Existing user data");
      if (existingUser?.deleted) {
        if (existingUser.delete_process_started_epoch > 0) {
          return {
            status: "deleting",
            userId: existingUser.id,
          };
        }
      }
    } catch (err) {
      adminLogger.error({ err, userId }, "[DELETE USER] User deletion error");
      return {
        status: "failed",
        userId,
      };
    }
    adminLogger.info({ userId }, "Return delete result");
    return {
      status: "done",
      userId,
    };
  }

  /** Get an array of 2 item arrays with `[ user IDs, delete_process_started_epoch ]` that are incompletely deleted */
  async listUsersPendingDeletion() {
    const users = (
      await (await this.getRepos()).user.find({}, { $gt: [["delete_process_started_epoch", 0]] })
    ).getEntities();
    return users.map(({ id, delete_process_started_epoch }) => [id, delete_process_started_epoch]);
  }

  async getUserIdByEmail(email: string) {
    const user = await gr.services.users.get({ email_canonical: email });

    return user?.id;
  }
}
