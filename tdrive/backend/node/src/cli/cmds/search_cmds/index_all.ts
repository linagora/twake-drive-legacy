import yargs from "yargs";
import tdrive from "../../../tdrive";
import ora from "ora";
import { TdrivePlatform } from "../../../core/platform/platform";
import { DatabaseServiceAPI } from "../../../core/platform/services/database/api";
import { Pagination } from "../../../core/platform/framework/api/crud-service";

import User, { TYPE as UserTYPE } from "../../../services/user/entities/user";
import Repository from "../../../core/platform/services/database/services/orm/repository/repository";
import { SearchServiceAPI } from "../../../core/platform/services/search/api";
import CompanyUser, { TYPE as CompanyUserTYPE } from "../../../services/user/entities/company_user";
import gr from "../../../services/global-resolver";

type Options = {
  repository?: string;
  repairEntities?: boolean;
};

class SearchIndexAll {
  database: DatabaseServiceAPI;
  search: SearchServiceAPI;

  constructor(readonly platform: TdrivePlatform) {
    this.database = this.platform.getProvider<DatabaseServiceAPI>("database");
    this.search = this.platform.getProvider<SearchServiceAPI>("search");
  }

  public async run(options: Options = {}): Promise<void> {
    const repositories: Map<string, Repository<any>> = new Map();
    repositories.set("users", await this.database.getRepository(UserTYPE, User));

    const repository = repositories.get(options.repository);
    if (!repository) {
      throw (
        "No repository set (or valid) ready for indexation, available are: " +
        Array.from(repositories.keys()).join(", ")
      );
    }

    // Complete user with companies in cache
    if (options.repository === "users" && options.repairEntities) {
      console.log("Complete user with companies in cache");
      const companiesUsersRepository = await this.database.getRepository(
        CompanyUserTYPE,
        CompanyUser,
      );
      const userRepository = await this.database.getRepository(UserTYPE, User);
      let page: Pagination = { limitStr: "100" };
      // For each rows
      do {
        const list = await userRepository.find({}, { pagination: page }, undefined);

        for (const user of list.getEntities()) {
          const companies = await companiesUsersRepository.find(
            { user_id: user.id },
            {},
            undefined,
          );

          user.cache ||= { companies: [] };
          user.cache.companies = companies.getEntities().map(company => company.group_id);
          await repositories.get("users").save(user, undefined);
        }

        page = list.nextPage as Pagination;
        await new Promise(r => setTimeout(r, 200));
      } while (page.page_token);
    }

    console.log("Start indexing...");
    let count = 0;
    // Get all items
    let page: Pagination = { limitStr: "100" };
    do {
      console.log("Indexed " + count + " items...");
      const list = await repository.find({}, { pagination: page }, undefined);
      page = list.nextPage as Pagination;
      await this.search.upsert(list.getEntities());
      count += list.getEntities().length;
      await new Promise(r => setTimeout(r, 200));
    } while (page.page_token);

    console.log("Emptying flush (10s)...");
    await new Promise(r => setTimeout(r, 10000));

    console.log("Done!");
  }
}

const services = [
  "search",
  "database",
  "webserver",
  "auth",
  "counter",
  "cron",
  "message-queue",
  "push",
  "realtime",
  "storage",
  "tracker",
  "websocket",
  "email-pusher",
];

const command: yargs.CommandModule<unknown, unknown> = {
  command: "index",
  describe: "command to reindex search middleware from db entities",
  builder: {
    repository: {
      type: "string",
      description: "Choose a repository to reindex",
    },
    repairEntities: {
      default: false,
      type: "boolean",
      description: "Choose to repair entities too when possible",
    },
  },
  handler: async argv => {
    const spinner = ora({ text: "Reindex repository - " }).start();
    const platform = await tdrive.run(services);
    await gr.doInit(platform);
    const migrator = new SearchIndexAll(platform);

    const repository = (argv.repository || "") as string;

    // Let this run even without a repository as its error message includes valid repository names
    await migrator.run({
      repository,
    });

    spinner.stop();
  },
};

export default command;
