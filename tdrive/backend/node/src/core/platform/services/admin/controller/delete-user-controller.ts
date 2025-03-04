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

  /** Begin or forward the deletion process of a user */
  async deleteUser(userId: string): Promise<"failed" | "deleting" | "done"> {
    try {
      await gr.services.users.anonymizeAndDelete({ id: userId }, {
        user: { server_request: true },
        company: { id: "// TODO: REPLACE WITH COMPANY ID" },
      } as unknown as ExecutionContext);
      const existingUser = await (await this.getRepos()).user.findOne({ id: userId });
      if (existingUser?.deleted) {
        if (existingUser.delete_process_started_epoch > 0) return "deleting";
      }
    } catch (err) {
      adminLogger.error({ err, userId }, "User deletion error");
      console.log(err); //TODO: NONONO
      return "failed";
    }
    return "done";
  }

  /** Get an array of user IDs that are incompletely deleted */
  async listUsersPendingDeletion() {
    return (
      await (await this.getRepos()).user.find({}, { $gt: [["delete_process_started_epoch", 0]] })
    )
      .getEntities()
      .map(({ id }) => id);
  }
}
