import yargs from "yargs";
import ora from "ora";

import { TdrivePlatform } from "../../../core/platform/platform";
import { DatabaseServiceAPI } from "../../../core/platform/services/database/api";

import User, { TYPE as UserTYPE } from "../../../services/user/entities/user";
import { DriveFile, TYPE as DriveFileTYPE } from "../../../services/documents/entities/drive-file";

import Repository from "../../../core/platform/services/database/services/orm/repository/repository";
import {
  EntityTarget,
  FindOptions,
  SearchServiceAPI,
} from "../../../core/platform/services/search/api";
import CompanyUser, { TYPE as CompanyUserTYPE } from "../../../services/user/entities/company_user";
import runWithPlatform from "../../lib/run_with_platform";
import SearchRepository from "src/core/platform/services/search/repository";
import parseYargsCommaSeparatedStringArray from "../../utils/yargs-comma-array";
import waitTimeoutMS from "../../utils/wait-timeout";
import iterateOverRepoPages from "../../utils/iterate-over-repository-pages";
import globalResolver from "../../../services/global-resolver";
import { couldGetKeywordsOfFile, getKeywordsOfFile } from "../../../services/documents/utils";

type Options = {
  spinner: ora.Ora;
  repairEntities: boolean;
  filterDocumentsByUserEMail: string[];
};

const repairEntitiesArgumentDetails = [];

/** This is an abstract base class for re-index cli commands; it stores runtime options
 *  into fields; runs repair first if request and re-indexes generically from the database
 *  to search services. */
abstract class ReindexerCLICommand<Entity> {
  protected readonly database: DatabaseServiceAPI;
  protected readonly search: SearchServiceAPI;
  constructor(
    protected readonly platform: TdrivePlatform,
    protected readonly options: Options,
    private readonly table: string,
    private readonly entity: EntityTarget<Entity>,
  ) {
    this.database = this.platform.getProvider<DatabaseServiceAPI>("database");
    this.search = this.platform.getProvider<SearchServiceAPI>("search");
  }
  private _dbRepo: Repository<Entity>;
  protected async dbRepository() {
    return (this._dbRepo =
      this._dbRepo || (await this.database.getRepository<Entity>(this.table, this.entity)));
  }
  private _searchRepo: SearchRepository<Entity>;
  protected async searchRepository() {
    return (this._searchRepo =
      this._searchRepo || this.search.getRepository<Entity>(this.table, this.entity));
  }

  protected statusStart(info: string) {
    this.options.spinner.start(`${this.table} > ${info}`);
  }
  protected statusSucceed(info: string) {
    this.options.spinner.succeed(`${this.table} > ${info}`);
  }
  protected statusWarn(info: string) {
    this.options.spinner.warn(`${this.table} > ${info}`);
  }
  protected statusFail(info: string) {
    this.options.spinner.fail(`${this.table} > ${info}`);
  }
  protected statusInfo(info: string) {
    this.options.spinner.info(`${this.table} > ${info}`);
  }

  /** Override in sub-classes to translate a page from database to search entities.
   * This is called by `reindexFromDBToSearch` so if that is overriden; this won't be called.
   */
  protected async mapEntitiesToReIndexFromDBToSearch(entities: Entity[]): Promise<Entity[]> {
    return entities;
  }

  /** Override in sub-classes that have filters (eg. from arguments) for the entities to re-index/repair */
  protected async prepareFindOptionsForItemsToReIndex(): Promise<FindOptions | undefined> {
    return undefined;
  }

  /** Override in sub-classes that handle the --repairEntities argument.
   * It is executed before reindexFromDBToSearch. What repair means depends
   * on the entity type.
   */
  protected async repairEntities(_findOptions: FindOptions): Promise<void> {
    this.statusWarn(`repairEntities > No repair action for ${this.table}`);
  }

  /** Override in a sub-class to completely replace the re-indexing logic.
   * - Iterates over pages of the entity from the database repository
   *     - calls `mapEntitiesToReIndexFromDBToSearch` to convert each page to a search entity
   *     - and upserts the result into the search repository
   */
  protected async reindexFromDBToSearch(findOptions: FindOptions): Promise<void> {
    const repository = await this.dbRepository();
    this.statusStart("Start indexing...");
    let count = 0;
    await iterateOverRepoPages(
      repository,
      async entities => {
        entities = await this.mapEntitiesToReIndexFromDBToSearch(entities);
        await this.search.upsert(entities);
        count += entities.length;
        this.statusStart(`Indexed ${count} ${this.table}...`);
      },
      findOptions,
    );
    if (count === 0) this.statusWarn(`Index ${this.table} finished; but 0 items included`);
    else this.statusSucceed(`${count} ${this.table} indexed`);
    const giveFlushAChanceDurationMS = 10000;
    this.statusStart(`Emptying flush (${giveFlushAChanceDurationMS / 1000}s)...`);
    await waitTimeoutMS(giveFlushAChanceDurationMS);
    this.statusSucceed("Done!");
  }

  /** Run both operations: repair if requested and re-index */
  public async run(): Promise<void> {
    const findOptions = await this.prepareFindOptionsForItemsToReIndex();
    if (this.options.repairEntities) await this.repairEntities(findOptions);
    await this.reindexFromDBToSearch(findOptions);
  }
}

/** Serves as an index of classes for the repos to reindex; to specialise bits of behaviour and what not */
const RepositoryNameToCTOR = new Map<
  string,
  (platform: TdrivePlatform, options: Options) => ReindexerCLICommand<any>
>();

class UserReindexerCLICommand extends ReindexerCLICommand<User> {
  constructor(platform: TdrivePlatform, options: Options) {
    super(platform, options, UserTYPE, User);
  }

  protected override async repairEntities(_findOptions: FindOptions): Promise<void> {
    this.statusStart("repairEntities > Adding companies to cache of user");
    const companiesUsersRepository = await this.database.getRepository(
      CompanyUserTYPE,
      CompanyUser,
    );
    let count = 0;
    const repository = await this.dbRepository();
    await iterateOverRepoPages(repository, async entities => {
      for (const user of entities) {
        const companies = await companiesUsersRepository.find({ user_id: user.id }, {}, undefined);
        const prevCache = JSON.stringify(user.cache);
        user.cache ||= { companies: [] };
        user.cache.companies = companies.getEntities().map(company => company.group_id);
        const newCache = JSON.stringify(user.cache);
        if (prevCache != newCache) await repository.save(user, undefined);
      }
      count += entities.length;
      this.statusStart(`repairEntities > Adding companies to cache of ${count} users...`);
    });
    this.statusSucceed(`repairEntities > Added companies to cache of ${count} users`);
  }
}
RepositoryNameToCTOR.set(
  "users",
  (platform, options) => new UserReindexerCLICommand(platform, options),
);
repairEntitiesArgumentDetails.push(
  "users: Rebuild cache.companies and save to database if changed",
);

class DocumentsReindexerCLICommand extends ReindexerCLICommand<DriveFile> {
  constructor(platform: TdrivePlatform, options: Options) {
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
  protected override async repairEntities(findOptions: FindOptions): Promise<void> {
    /*
    //Todo:
      - [ ] Batch saves
      - [ ] Refactor repair into mapping
      - [ ] Check save does upsert
      - [ ] Remove logs
      - [ ] Document this:
          For each item in DB
            Download
              - [ ] Decide if download fails ? Flag file ? Delete entity ?
            If keywords changed
              Save to DB
            - [ ] Delete file
    */

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
RepositoryNameToCTOR.set(
  "documents",
  (platform, options) => new DocumentsReindexerCLICommand(platform, options),
);
repairEntitiesArgumentDetails.push(
  "documents: Download and re-extract keywords before re-indexing",
);
class _BufferedAction<Entity> {
  private buffer: Entity[];
  constructor(
    private readonly batchSize: number,
    private readonly action: (entities: Entity[]) => Promise<void>,
  ) {}
  public async flush() {
    const buffer = this.buffer;
    if (!buffer.length) return;
    this.buffer = new Array(this.batchSize);
    return this.action(buffer);
  }
  public async save(entity: Entity) {
    this.buffer.push(entity);
    if (this.buffer.length >= this.batchSize) await this.flush();
  }
}
import { logger } from "../../../core/platform/framework/logger";

const reindexingArgumentGroupTitle = "Re-indexing options";
const repositoryArgumentName = "repository";
const command: yargs.CommandModule<unknown, unknown> = {
  command: "index",
  describe: "command to reindex search middleware from db entities",
  builder: {
    [repositoryArgumentName]: {
      type: "string",
      description: "Repository to re-index.",
      choices: [...RepositoryNameToCTOR.keys()],
      demandOption: true,
      group: reindexingArgumentGroupTitle,
    },
    repairEntities: {
      default: false,
      type: "boolean",
      description: ["Repair entities too when possible", ...repairEntitiesArgumentDetails].join(
        "\n- ",
      ),
      group: reindexingArgumentGroupTitle,
    },
    filterDocumentsByUserEMail: {
      type: "string",
      alias: "e",
      description:
        "When processing documents, limit to those owned by the users with the provided comma separated e-mails",
      group: "Filtering for documents repository",
    },
  },
  handler: async argv => {
    const repositories = parseYargsCommaSeparatedStringArray(
      argv[repositoryArgumentName] as string /* ignore typechecker */,
    );
    const filterDocumentsByUserEMail = parseYargsCommaSeparatedStringArray(
      argv.filterDocumentsByUserEMail as string /* ignore typechecker */,
    );
    await runWithPlatform("Re-index", async ({ spinner, platform }) => {
      try {
        logger.level = "debug";
        for (const repositoryName of repositories)
          await RepositoryNameToCTOR.get(repositoryName)(platform, {
            spinner,
            repairEntities: !!argv.repairEntities,
            filterDocumentsByUserEMail,
          }).run();
      } catch (err) {
        spinner.fail(err.stack || err);
        return 1;
      }
    });
  },
};

export default command;
