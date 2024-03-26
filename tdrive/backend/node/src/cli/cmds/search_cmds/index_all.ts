import yargs from "yargs";
import ora from "ora";

import { TdrivePlatform } from "../../../core/platform/platform";
import { DatabaseServiceAPI } from "../../../core/platform/services/database/api";
import { Pagination } from "../../../core/platform/framework/api/crud-service";

import User, { TYPE as UserTYPE } from "../../../services/user/entities/user";
import { DriveFile, TYPE as DriveFileTYPE } from "../../../services/documents/entities/drive-file";

import Repository, {
  FindFilter,
} from "../../../core/platform/services/database/services/orm/repository/repository";
import { EntityTarget, SearchServiceAPI } from "../../../core/platform/services/search/api";
import CompanyUser, { TYPE as CompanyUserTYPE } from "../../../services/user/entities/company_user";
import runWithPlatform from "../../lib/run_with_platform";
import SearchRepository from "src/core/platform/services/search/repository";
import parseYargsCommaSeparatedStringArray from "../../utils/yargs_comma_array";

type Options = {
  spinner: ora.Ora;
  repairEntities: boolean;
};

const waitTimeoutMS = (ms: number) => ms > 0 && new Promise(r => setTimeout(r, ms));
const defaultPageSize = "100";

async function iterateOverRepoPages<Entity>(
  repository: Repository<Entity>,
  forEachPage: (entities: Entity[]) => Promise<void>,
  pageSizeAsStringForReasons: string = defaultPageSize,
  filter: FindFilter = {},
  delayPerPageMS: number = 200,
) {
  let page: Pagination = { limitStr: pageSizeAsStringForReasons };
  do {
    const list = await repository.find(filter, { pagination: page }, undefined);
    await forEachPage(list.getEntities());
    page = list.nextPage as Pagination;
    await waitTimeoutMS(delayPerPageMS);
  } while (page.page_token);
}

abstract class ReindexerCLICommand<Entity> {
  protected readonly database: DatabaseServiceAPI;
  protected readonly search: SearchServiceAPI;
  constructor(
    protected readonly platform: TdrivePlatform,
    private readonly options: Options,
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

  protected async repairEntities(): Promise<void> {
    this.statusWarn(`repairEntities > No repair action for ${this.table}`);
  }

  protected async mapEntitiesToReIndexFromDBToSearch(entities: Entity[]): Promise<Entity[]> {
    return entities;
  }

  protected async reindexFromDBToSearch(): Promise<void> {
    const repository = await this.dbRepository();
    this.statusStart("Start indexing...");
    let count = 0;
    await iterateOverRepoPages(repository, async entities => {
      entities = await this.mapEntitiesToReIndexFromDBToSearch(entities);
      await this.search.upsert(entities);
      count += entities.length;
      this.statusStart(`Indexed ${count} ${this.table}...`);
    });
    if (count === 0) this.statusWarn(`Index ${this.table} finished; but 0 items included`);
    else this.statusSucceed(`${count} ${this.table} indexed`);
    const giveFlushAChanceDurationMS = 10000;
    this.statusStart(`Emptying flush (${giveFlushAChanceDurationMS / 1000}s)...`);
    await waitTimeoutMS(giveFlushAChanceDurationMS);
    this.statusSucceed("Done!");
  }
  public async run(): Promise<void> {
    if (this.options.repairEntities) await this.repairEntities();
    await this.reindexFromDBToSearch();
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

  protected override async repairEntities(): Promise<void> {
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

class DocumentsReindexerCLICommand extends ReindexerCLICommand<DriveFile> {
  constructor(platform: TdrivePlatform, options: Options) {
    super(platform, options, DriveFileTYPE, DriveFile);
  }
}
RepositoryNameToCTOR.set(
  "documents",
  (platform, options) => new DocumentsReindexerCLICommand(platform, options),
);

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
      description: "Repair entities too when possible",
      group: reindexingArgumentGroupTitle,
    },
  },
  handler: async argv => {
    const repositories = parseYargsCommaSeparatedStringArray(
      argv[repositoryArgumentName] as string /* ignore typechecker */,
    );
    runWithPlatform("Re-index", async ({ spinner, platform }) => {
      try {
        for (const repositoryName of repositories)
          await RepositoryNameToCTOR.get(repositoryName)(platform, {
            spinner,
            repairEntities: !!argv.repairEntities,
          }).run();
      } catch (err) {
        spinner.fail(err.stack || err);
        return 1;
      }
    });
  },
};

export default command;
