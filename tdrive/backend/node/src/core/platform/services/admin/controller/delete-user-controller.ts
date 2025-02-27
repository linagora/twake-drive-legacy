import gr from "../../../../../services/global-resolver";

import type { ExecutionContext } from "../../../../platform/framework/api/crud-service";

import { adminLogger, buildUserDeletionRepositories } from "../utils";

// /**
//  * Create all repositories required for deleting a user
//  * @deprecated Do not use this outside of this file, it is exported exclusively for e2e tests
//  */
// export async function buildUserDeletionRepositories(
//   db: DatabaseServiceAPI,
//   search: SearchServiceAPI,
// ) {
//   return {
//     driveFile: await db.getRepository<DriveFile>(DriveFileType, DriveFile),
//     file: await db.getRepository<File>(FileType, File),
//     fileVersion: await db.getRepository<FileVersion>(FileVersionType, FileVersion),

//     user: await db.getRepository<User>(UserType, User),
//     companyUser: await db.getRepository<CompanyUser>(CompanyUserType, CompanyUser),
//     externalUser: await db.getRepository<ExternalUser>(ExternalUserType, ExternalUser),

//     // company: await db.getRepository<Company>(CompanyType, Company),
//     // missed_drive_files
//     // session
//     // user_online

//     search: {
//       driveFile: await search.getRepository<DriveFile>(DriveFileType, DriveFile),
//       user: await search.getRepository<User>(UserType, User),
//     },
//   };
// }

export class AdminDeleteUserController {
  private constructor(
    private readonly repos: Awaited<ReturnType<typeof buildUserDeletionRepositories>>,
  ) {}
  public static async create() {
    return new AdminDeleteUserController(
      await buildUserDeletionRepositories(gr.database, gr.platformServices.search),
    );
  }
  // fisherYattesShuffleInPlace

  /** Begin or forward the deletion process of a user */
  async deleteUser(userId: string): Promise<"failed" | "deleting" | "done"> {
    try {
      await gr.services.users.anonymizeAndDelete({ id: userId }, {
        user: { server_request: true },
        company: { id: "// TODO: REPLACE WITH COMPANY ID" },
      } as unknown as ExecutionContext);
      const existingUser = await this.repos.user.findOne({ id: userId });
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
    return (await this.repos.user.find({}, { $gt: [["delete_process_started_epoch", 0]] }))
      .getEntities()
      .map(({ id }) => id);
  }
}
