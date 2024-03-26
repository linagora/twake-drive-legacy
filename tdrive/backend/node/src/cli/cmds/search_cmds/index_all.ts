import yargs from "yargs";
import ora from "ora";

import { TdrivePlatform } from "../../../core/platform/platform";
import { DatabaseServiceAPI } from "../../../core/platform/services/database/api";
import { Pagination } from "../../../core/platform/framework/api/crud-service";

import User, { TYPE as UserTYPE } from "../../../services/user/entities/user";
import Repository, {
  FindFilter,
} from "../../../core/platform/services/database/services/orm/repository/repository";
import { EntityTarget, SearchServiceAPI } from "../../../core/platform/services/search/api";
import CompanyUser, { TYPE as CompanyUserTYPE } from "../../../services/user/entities/company_user";
import runWithPlatform from "../../lib/run_with_platform";

type Options = {
  spinner: ora.Ora;
  repositoryName?: string;
  repairEntities: boolean;
};

const waitTimeoutMS = (ms: number) => ms > 0 && new Promise(r => setTimeout(r, ms));

async function iterateOverRepoPages<Entity>(
  repository: Repository<Entity>,
  forEachPage: (entities: Entity[]) => Promise<void>,
  pageSizeAsStringForReasons: string = "100",
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

type RepositoryConstructor<Entity> = (database: DatabaseServiceAPI) => Promise<Repository<Entity>>;

const makeRepoConstructor =
  <Entity>(table: string, entity: EntityTarget<Entity>): RepositoryConstructor<Entity> =>
  database =>
    database.getRepository<Entity>(table, entity);

/** The commandline name for the user repository. It has specific code for the repairEntities so is defined here. */
const UsersRepoName = "users";

class SearchIndexAll {
  database: DatabaseServiceAPI;
  search: SearchServiceAPI;

  constructor(readonly platform: TdrivePlatform) {
    this.database = this.platform.getProvider<DatabaseServiceAPI>("database");
    this.search = this.platform.getProvider<SearchServiceAPI>("search");
  }

  private static readonly supportedRepos = new Map<string, RepositoryConstructor<any>>([
    [UsersRepoName, makeRepoConstructor(UserTYPE, User)],
  ]);
  public static isRepoSupported = (repositoryName: string) =>
    this.supportedRepos.has(repositoryName);
  public static getSupportedRepoNames = () => [...this.supportedRepos.keys()];
  private getRepository = (repositoryName: string) =>
    SearchIndexAll.supportedRepos.get(repositoryName)(this.database);

  private async repairEntitiesInUsers(
    options: Options,
    repository: Repository<User>,
  ): Promise<void> {
    // Complete user with companies in cache
    options.spinner.start("Adding companies to cache of user");
    const companiesUsersRepository = await this.database.getRepository(
      CompanyUserTYPE,
      CompanyUser,
    );
    let count = 0;
    await iterateOverRepoPages(
      repository,
      async entities => {
        for (const user of entities) {
          const companies = await companiesUsersRepository.find(
            { user_id: user.id },
            {},
            undefined,
          );
          user.cache ||= { companies: [] };
          user.cache.companies = companies.getEntities().map(company => company.group_id);
          await repository.save(user, undefined);
        }
        count += entities.length;
        options.spinner.start(`Adding companies to cache of ${count} users...`);
      },
      "2",
    );
    options.spinner.succeed(`Added companies to cache of ${count} users`);
  }

  private repairEntities(options: Options, repository: Repository<any>): Promise<void> {
    switch (options.repositoryName) {
      case UsersRepoName:
        return this.repairEntitiesInUsers(options, repository);
      default:
        options.spinner.warn(`No repair action for repository ${options.repositoryName}`);
        break;
    }
  }

  public async run(options: Options): Promise<void> {
    const repository = await this.getRepository(options.repositoryName);

    if (options.repairEntities) await this.repairEntities(options, repository);

    options.spinner.start(`Start indexing ${options.repositoryName}...`);
    let count = 0;
    await iterateOverRepoPages(repository, async entities => {
      await this.search.upsert(entities);
      count += entities.length;
      options.spinner.start(`Indexed ${count} ${options.repositoryName}...`);
    });
    if (count === 0)
      options.spinner.warn(`Index ${options.repositoryName} finished; but 0 items included`);
    else options.spinner.succeed(`${count} ${options.repositoryName} indexed`);
    const giveFlushAChanceDurationMS = 10000;
    options.spinner.start(`Emptying flush (${giveFlushAChanceDurationMS / 1000}s)...`);
    await waitTimeoutMS(giveFlushAChanceDurationMS);
    options.spinner.succeed("Done!");
  }
}
const reindexingArgumentGroupTitle = "Re-indexing options";
const repositoryArgumentName = "repository";
const command: yargs.CommandModule<unknown, unknown> = {
  command: "index",
  describe: "command to reindex search middleware from db entities",
  builder: {
    [repositoryArgumentName]: {
      type: "string",
      description: "Repository to re-index.",
      choices: SearchIndexAll.getSupportedRepoNames(),
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
    const repositoryArg = argv[repositoryArgumentName];
    const repositories =
      typeof repositoryArg === "string" ? [repositoryArg] : (repositoryArg as [string]);

    function* eachOnlyOnce<T>(list: Iterable<T>): Iterable<T> {
      const seen = new Set<T>();
      for (const item of list) {
        if (seen.has(item)) continue;
        seen.add(item);
        yield item;
      }
    }

    runWithPlatform("Re-index " + argv.repository, async ({ spinner, platform }) => {
      try {
        const migrator = new SearchIndexAll(platform);
        for (const repositoryName of eachOnlyOnce(repositories)) {
          await migrator.run({
            repositoryName,
            spinner,
            repairEntities: !!argv.repairEntities,
          });
        }
      } catch (err) {
        spinner.fail(`Error indexing: ${err.stack}`);
        return 1;
      }
    });
  },
};

export default command;
