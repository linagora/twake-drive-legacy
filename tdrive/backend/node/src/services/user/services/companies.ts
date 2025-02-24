import _, { merge } from "lodash";

import {
  CrudException,
  DeleteResult,
  ExecutionContext,
  ListResult,
  OperationType,
  Paginable,
  Pagination,
  SaveResult,
} from "../../../core/platform/framework/api/crud-service";
import Repository, {
  FindOptions,
} from "../../../core/platform/services/database/services/orm/repository/repository";
import { UserPrimaryKey } from "../entities/user";
import Company, {
  CompanyPrimaryKey,
  CompanySearchKey,
  getInstance as getCompanyInstance,
} from "../entities/company";
import CompanyUser, {
  CompanyUserPrimaryKey,
  getInstance as getCompanyUserInstance,
} from "../entities/company_user";
import { ListUserOptions } from "./users/types";
import { CompanyUserRole } from "../web/types";
import { ResourceEventsPayload, uuid } from "../../../utils/types";
import ExternalGroup, {
  ExternalGroupPrimaryKey,
  getInstance as getExternalGroupInstance,
} from "../entities/external_company";
import { logger } from "../../../core/platform/framework";
import gr from "../../global-resolver";
import { localEventBus } from "../../../core/platform/framework/event-bus";

export class CompanyServiceImpl {
  version: "1";
  companyRepository: Repository<Company>;
  externalCompanyRepository: Repository<ExternalGroup>;
  companyUserRepository: Repository<CompanyUser>;

  async init(): Promise<this> {
    this.companyRepository = await gr.database.getRepository<Company>("group_entity", Company);
    this.companyUserRepository = await gr.database.getRepository<CompanyUser>(
      "group_user",
      CompanyUser,
    );
    this.externalCompanyRepository = await gr.database.getRepository<ExternalGroup>(
      "external_group_repository",
      ExternalGroup,
    );

    return this;
  }

  private getExtCompany(pk: ExternalGroupPrimaryKey, context?: ExecutionContext) {
    return this.externalCompanyRepository.findOne(pk, {}, context);
  }

  async updateCompany<SaveOptions>(
    company: Company,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: SaveOptions,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context?: ExecutionContext,
  ): Promise<SaveResult<Company>> {
    if (company.identity_provider_id && !company.identity_provider) {
      company.identity_provider = "console";
    }

    await this.companyRepository.save(company, context);

    if (company.identity_provider_id) {
      const key = {
        service_id: company.identity_provider,
        external_id: company.identity_provider_id,
      };

      const extCompany = (await this.getExtCompany(key, context)) || getExternalGroupInstance(key);

      extCompany.company_id = company.id;
      extCompany.external_id = company.identity_provider_id;
      extCompany.service_id = company.identity_provider;

      await this.externalCompanyRepository.save(extCompany, context);
    }

    return new SaveResult<Company>("company", company, OperationType.UPDATE);
  }

  async createCompany(company: Company): Promise<Company> {
    const companyToCreate: Company = getCompanyInstance({
      ...company,
      ...{
        dateAdded: Date.now(),
      },
    });

    const result = await this.updateCompany(companyToCreate);

    return result.entity;
  }

  async getCompany(
    companySearchKey: CompanySearchKey,
    context?: ExecutionContext,
  ): Promise<Company> {
    if (companySearchKey.id) {
      return this.companyRepository.findOne(companySearchKey, {}, context);
    } else if (companySearchKey.identity_provider_id) {
      const extCompany = await this.getExtCompany(
        {
          external_id: companySearchKey.identity_provider_id,
          service_id: companySearchKey.identity_provider || "console",
        },
        context,
      );
      if (!extCompany) {
        return null;
      }
      return await this.companyRepository.findOne({ id: extCompany.company_id }, {}, context);
    }
  }

  async getCompanyUser(
    company: CompanyPrimaryKey,
    user: UserPrimaryKey,
    context?: ExecutionContext,
  ): Promise<CompanyUser> {
    const companyUser = await this.companyUserRepository.findOne(
      {
        group_id: company.id,
        user_id: user.id,
      },
      {},
      context,
    );
    if (companyUser) companyUser.applications = [];
    return companyUser;
  }

  async getAllForUser(userId: uuid, context?: ExecutionContext): Promise<CompanyUser[]> {
    const list = await this.companyUserRepository
      .find({ user_id: userId }, {}, context)
      .then(a => a.getEntities());

    // Update user cache with companies
    const user = await gr.services.users.get({ id: userId });
    if (
      user.cache?.companies.length === 0 ||
      _.difference(
        list.map(c => c.group_id),
        user.cache?.companies || [],
      ).length != 0
    ) {
      if (!user.cache) user.cache = { companies: [] };
      user.cache.companies = list.map(c => c.group_id);
      await gr.services.users.save(user, { user: { id: user.id, server_request: true } });
    }

    return list;
  }

  getCompanies(paginable?: Paginable, context?: ExecutionContext): Promise<ListResult<Company>> {
    return this.companyRepository.find(
      {},
      {
        pagination: new Pagination(
          paginable?.page_token,
          paginable?.limitStr || "100",
          paginable?.reversed,
        ),
      },
      context,
    );
  }

  async removeUserFromCompany(
    companyPk: CompanyPrimaryKey,
    userPk: UserPrimaryKey,
    context?: ExecutionContext,
  ): Promise<DeleteResult<CompanyUser>> {
    const entity = await this.companyUserRepository.findOne(
      {
        group_id: companyPk.id,
        user_id: userPk.id,
      },
      {},
      context,
    );
    if (entity) {
      await Promise.all([this.companyUserRepository.remove(entity, context)]);

      const user = await gr.services.users.get(userPk);
      if ((user.cache?.companies || []).includes(companyPk.id)) {
        // Update user cache with companies
        user.cache.companies = user.cache.companies.filter(id => id != companyPk.id);
        await gr.services.users.save(user, { user: { id: user.id, server_request: true } });
      }

      localEventBus.publish<ResourceEventsPayload>("company:user:deleted", {
        user: user,
        company: companyPk,
      });
    }

    return new DeleteResult("company_user", entity, true);
  }

  async getUsers(
    companyId: CompanyUserPrimaryKey,
    pagination?: Pagination,
    options?: ListUserOptions,
    context?: ExecutionContext,
  ): Promise<ListResult<CompanyUser>> {
    const findOptions: FindOptions = {
      pagination,
    };

    if (options?.userIds) {
      findOptions.$in = [["user_id", options.userIds]];
    }

    return this.companyUserRepository.find({ group_id: companyId.group_id }, findOptions, context);
  }

  async delete(pk: CompanyPrimaryKey, context?: ExecutionContext): Promise<DeleteResult<Company>> {
    const instance = await this.companyRepository.findOne(pk, {}, context);
    if (instance) await this.companyRepository.remove(instance, context);
    return new DeleteResult<Company>("company", instance, !!instance);
  }

  async setUserRole(
    companyId: uuid,
    userId: uuid,
    role: CompanyUserRole = "member",
    level?: any,
    applications: string[] = [],
    context?: ExecutionContext,
  ): Promise<SaveResult<CompanyUser>> {
    const key = {
      group_id: companyId,
      user_id: userId,
    };
    let entity = await this.companyUserRepository.findOne(key, {}, context);

    if (entity == null) {
      entity = getCompanyUserInstance(merge(key, { dateAdded: Date.now() }));
    }

    entity.role = role;
    entity.applications = applications;
    await this.companyUserRepository.save(entity, context);

    const user = await gr.services.users.get({ id: userId });
    if (!(user.cache?.companies || []).includes(companyId)) {
      // Update user cache with companies
      if (!user.cache) user.cache = { companies: [] };
      user.cache.companies.push(companyId);
      await gr.services.users.save(user, { user: { id: user.id, server_request: true } });
    }

    return new SaveResult("company_user", entity, OperationType.UPDATE);
  }

  async removeCompany(searchKey: CompanySearchKey, context?: ExecutionContext): Promise<void> {
    if (searchKey.identity_provider_id) {
      const extCompany = await this.getExtCompany(
        {
          service_id: searchKey.identity_provider,
          external_id: searchKey.identity_provider_id,
        },
        context,
      );
      if (!extCompany) {
        throw CrudException.notFound(`Company ${searchKey.identity_provider_id} not found`);
      }
      await this.externalCompanyRepository.remove(extCompany, context);
      searchKey.id = extCompany.company_id;
    }

    const company = await this.getCompany({ id: searchKey.id });
    if (!company) {
      throw CrudException.notFound(`Company ${searchKey.id} not found`);
    }

    await this.companyRepository.remove(company, context);

    return Promise.resolve(null);
  }

  async getUsersCount(companyId: string): Promise<number> {
    return this.getCompany({ id: companyId }).then(a => a.memberCount);
  }

  async getUserRole(companyId: uuid, userId: uuid): Promise<CompanyUserRole> {
    if (!userId) return "guest";
    const companyUser = await this.getCompanyUser({ id: companyId }, { id: userId });
    if (!companyUser) {
      return "guest";
    }
    return companyUser.role;
  }

  async ensureDeletedUserNotInCompanies(userPk: UserPrimaryKey): Promise<void> {
    const user = await gr.services.users.get(userPk);
    if (user.deleted) {
      const companies = await this.getAllForUser(user.id);
      for (const company of companies) {
        logger.warn(`User ${userPk.id} is deleted so removed from company ${company.id}`);
        await this.removeUserFromCompany(company, user);
        try {
          await gr.services.workspaces.ensureUserNotInCompanyIsNotInWorkspace(userPk, company.id);
        } catch (err) {
          logger.error({ err }, "Error removing user from company from workspace");
        }
      }
    }
  }
}
