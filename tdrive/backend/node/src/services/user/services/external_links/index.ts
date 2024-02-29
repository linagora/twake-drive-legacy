import Repository from "../../../../core/platform/services/database/services/orm/repository/repository";
import ExternalUser from "../../entities/external_user";
import ExternalGroup from "../../entities/external_company";

import Company from "../../entities/company";
import User from "../../entities/user";
import gr from "../../../global-resolver";
import { ExecutionContext } from "../../../../core/platform/framework/api/crud-service";

export class UserExternalLinksServiceImpl {
  version: "1";
  private externalUserRepository: Repository<ExternalUser>;
  private externalGroupRepository: Repository<ExternalGroup>;
  private companyRepository: Repository<Company>;
  private userRepository: Repository<User>;

  async init(): Promise<this> {
    this.externalUserRepository = await gr.database.getRepository<ExternalUser>(
      "external_user_repository",
      ExternalUser,
    );
    this.externalGroupRepository = await gr.database.getRepository<ExternalGroup>(
      "external_group_repository",
      ExternalGroup,
    );
    this.companyRepository = await gr.database.getRepository<Company>("group_entity", Company);
    this.userRepository = await gr.database.getRepository<User>("user", User);

    return this;
  }

  async createExternalUser(user: ExternalUser, context?: ExecutionContext): Promise<ExternalUser> {
    await this.externalUserRepository.save(user, context);

    //Save user provider and provider id here
    const internalUser = await this.userRepository.findOne({ id: user.user_id }, {}, context);
    if (internalUser) {
      internalUser.identity_provider = user.service_id;
      internalUser.identity_provider_id = user.external_id;
      this.userRepository.save(internalUser, context);
    }

    return user;
  }
}
