import yargs from "yargs";
import ora from "ora";

import { TdrivePlatform } from "../../../core/platform/platform";
import { DatabaseServiceAPI } from "../../../core/platform/services/database/api";
import { Pagination } from "../../../core/platform/framework/api/crud-service";

import User, { TYPE as UserTYPE } from "../../../services/user/entities/user";
import Repository from "../../../core/platform/services/database/services/orm/repository/repository";
import { EntityTarget, SearchServiceAPI } from "../../../core/platform/services/search/api";
import CompanyUser, { TYPE as CompanyUserTYPE } from "../../../services/user/entities/company_user";
import runWithPlatform from "../../lib/run_with_platform";

type Options = {
  spinner: ora.Ora;
  repositoryName?: string;
  repairEntities: boolean;
};

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
    options.spinner.start("Complete user with companies in cache");
    const companiesUsersRepository = await this.database.getRepository(
      CompanyUserTYPE,
      CompanyUser,
    );
    let page: Pagination = { limitStr: "100" };
    let count = 0;
    do {
      const list = await repository.find({}, { pagination: page }, undefined);

      for (const user of list.getEntities()) {
        const companies = await companiesUsersRepository.find({ user_id: user.id }, {}, undefined);

        user.cache ||= { companies: [] };
        user.cache.companies = companies.getEntities().map(company => company.group_id);
        await repository.save(user, undefined);
      }
      count += list.getEntities().length;
      options.spinner.start(`Completed ${count} users with companies in cache...`);

      page = list.nextPage as Pagination;
      await new Promise(r => setTimeout(r, 2000));
    } while (page.page_token);
    options.spinner.succeed(`Completed ${count} users with companies in cache`);
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

    options.spinner.start("Start indexing...");
    let count = 0;
    // Get all items
    let page: Pagination = { limitStr: "100" };
    do {
      const list = await repository.find({}, { pagination: page }, undefined);
      page = list.nextPage as Pagination;
      await this.search.upsert(list.getEntities());
      count += list.getEntities().length;
      options.spinner.start("Indexed " + count + " items...");
      await new Promise(r => setTimeout(r, 200));
    } while (page.page_token);
    if (count === 0) options.spinner.warn("Index finieshed; but 0 items included");
    else options.spinner.succeed(`${count} items indexed`);
    options.spinner.start("Emptying flush (10s)...");
    await new Promise(r => setTimeout(r, 10000));
    options.spinner.succeed("Done!");
  }
}

const repositoryArgumentName = "repository";
const command: yargs.CommandModule<unknown, unknown> = {
  command: "index",
  describe: "command to reindex search middleware from db entities",
  builder: {
    [repositoryArgumentName]: {
      type: "string",
      description: `Repository name: ${SearchIndexAll.getSupportedRepoNames().join(", ")}`,
    },
    repairEntities: {
      default: false,
      type: "boolean",
      description: "Repair entities too when possible",
    },
  },
  handler: async argv => {
    const repositoryName = (argv[repositoryArgumentName] || "") as string;
    if (!(repositoryName && SearchIndexAll.isRepoSupported(repositoryName)))
      throw new Error(
        `${
          repositoryName ? `Invalid (${JSON.stringify(repositoryName)})` : "Missing"
        } repository.\n` +
          `\tSet with --${repositoryArgumentName} .\n` +
          `\tPossible values: ${SearchIndexAll.getSupportedRepoNames().join(", ")}.`,
      );

    runWithPlatform("Re-index " + argv.repository, async ({ spinner, platform }) => {
      try {
        const migrator = new SearchIndexAll(platform);
        await migrator.run({
          repositoryName,
          spinner,
          repairEntities: !!argv.repairEntities,
        });
        return 0;
      } catch (err) {
        spinner.fail(`Error indexing: ${err.stack}`);
        return 1;
      }
    });
  },
};

export default command;
