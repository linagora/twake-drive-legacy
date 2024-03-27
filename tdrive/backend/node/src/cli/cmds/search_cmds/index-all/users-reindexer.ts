import type { TdrivePlatform } from "../../../../core/platform/platform";
import type { FindOptions } from "../../../../core/platform/services/search/api";

import User, { TYPE as UserTYPE } from "../../../../services/user/entities/user";
import CompanyUser, {
  TYPE as CompanyUserTYPE,
} from "../../../../services/user/entities/company_user";

import iterateOverRepoPages from "../../../utils/iterate-over-repository-pages";

import BaseReindexer from "./base-reindexer";
import type ReindexerOptions from "./reindexer-options";

export default class UsersReindexer extends BaseReindexer<User> {
  constructor(platform: TdrivePlatform, options: ReindexerOptions) {
    super(platform, options, UserTYPE, User);
  }

  public static readonly repairActionDescription =
    "Rebuild cache.companies and save to database if changed";
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
