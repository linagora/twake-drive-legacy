import type { TdrivePlatform } from "../../../../core/platform/platform";
import type { FindOptions } from "../../../../core/platform/services/search/api";
import globalResolver from "../../../../services/global-resolver";

import {
  DriveFile,
  TYPE as DriveFileTYPE,
} from "../../../../services/documents/entities/drive-file";
import User, { TYPE as UserTYPE } from "../../../../services/user/entities/user";

import { couldGetKeywordsOfFile, getKeywordsOfFile } from "../../../../services/documents/utils";
import iterateOverRepoPages from "../../../utils/iterate-over-repository-pages";

import BaseReindexer from "./base-reindexer";
import type ReindexerOptions from "./reindexer-options";

export default class DocumentsReindexer extends BaseReindexer<DriveFile> {
  constructor(platform: TdrivePlatform, options: ReindexerOptions) {
    super(platform, options, DriveFileTYPE, DriveFile);
  }

  protected override async prepareFindOptionsForItemsToReIndex(): Promise<FindOptions> {
    if (this.options.filterDocumentsByUserEMail.length === 0)
      throw new Error(
        "No creator e-mail specified. This would affect all documents. To do this on purpose, add '--filterDocumentsByUserEMail all'",
      );
    if (this.options.filterDocumentsByUserEMail.join("-") === "all") {
      this.statusWarn("All users included in document re-index");
      return {};
    }
    if (this.options.filterDocumentsByUserEMail.indexOf("all") > -1)
      throw new Error(
        "If specifying 'all' to include all users, don't include another email argument.",
      );
    const userRepo = await this.database.getRepository<User>(UserTYPE, User);
    const emailsToIds = new Map<string, string | false>();
    const rawUserIds = [];
    this.options.filterDocumentsByUserEMail.forEach(email => {
      if (email.match(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i)) rawUserIds.push(email);
      else emailsToIds.set(email, false);
    });
    await iterateOverRepoPages(
      userRepo,
      async entities => {
        entities.forEach(({ id, email_canonical }) => emailsToIds.set(email_canonical, id));
      },
      { $in: [["email_canonical", this.options.filterDocumentsByUserEMail]] },
    );
    const failedToFindEmails = [];
    for (const [email, id] of emailsToIds) if (id === false) failedToFindEmails.push(email);
    if (failedToFindEmails.length > 0)
      throw new Error("No user id found for email(s): " + JSON.stringify(failedToFindEmails));
    this.statusInfo("Documents of user(s):");
    for (const [email, id] of emailsToIds) this.statusInfo(`\t- ${email}: ${id}`);
    for (const id of rawUserIds) this.statusInfo(`\t- ${id}`);
    return { $in: [["creator", [...rawUserIds, ...emailsToIds.values()]]] };
  }

  public static readonly repairActionDescription =
    "Download and re-extract keywords before re-indexing";
  protected override async repairEntities(findOptions: FindOptions): Promise<void> {
    const repository = await this.dbRepository();
    await iterateOverRepoPages(
      repository,
      async entities => {
        for (const entity of entities) {
          if (entity.is_directory)
            // || entity.is_in_trash) // why not index trash too after all
            continue;
          this.statusInfo(
            `-> Downloading ${entity.name} (${entity.size}b id: ${entity.id} creator: ${entity.creator}`,
          );
          try {
            if (
              entity.size === 0 ||
              !couldGetKeywordsOfFile(
                entity.last_version_cache.file_metadata.mime,
                entity.last_version_cache.file_metadata.name || entity.name,
              )
            ) {
              this.statusInfo("\tSkipping, 0 size or couldGetKeywordsOfFile returned nope");
              continue;
            }
            const storedFile = await globalResolver.services.files.download(
              entity.last_version_cache.file_metadata.external_id,
              { company: { id: entity.company_id }, user: null },
            );
            const content_keywords = await getKeywordsOfFile(
              storedFile.mime,
              storedFile.name,
              storedFile.file,
            );
            if (storedFile.size != entity.size)
              this.statusWarn(
                `Warning, file ${entity.id} (${entity.name}) has size ${entity.size} in DB but ${storedFile.size} when downloaded`,
              );
            if (content_keywords !== entity.content_keywords) {
              entity.content_keywords = content_keywords;
              repository.save(entity);
            }
          } catch (err) {
            this.statusFail(err.stack);
          }
        }
      },
      findOptions,
    );
  }
}
