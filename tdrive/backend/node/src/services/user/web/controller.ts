import { FastifyReply, FastifyRequest } from "fastify";
import {
  CrudException,
  ExecutionContext,
  ListResult,
  Pagination,
} from "../../../core/platform/framework/api/crud-service";

import { CrudController } from "../../../core/platform/services/webserver/types";
import {
  ResourceCreateResponse,
  ResourceDeleteResponse,
  ResourceGetResponse,
  ResourceListResponse,
} from "../../../utils/types";

import User from "../entities/user";
import {
  CompanyObject,
  CompanyParameters,
  CompanyStatsObject,
  CompanyUserObject,
  DeregisterDeviceParams,
  RegisterDeviceBody,
  RegisterDeviceParams,
  UserListQueryParameters,
  UserObject,
  UserParameters,
  CompanyUsersParameters,
  UserQuota,
} from "./types";
import Company from "../entities/company";
import CompanyUser from "../entities/company_user";
import coalesce from "../../../utils/coalesce";
import { getCompanyRooms, getUserRooms } from "../realtime";
import { formatCompany, getCompanyStats } from "../utils";
import { formatUser } from "../../../utils/users";
import gr from "../../global-resolver";
import config from "config";

export class UsersCrudController
  implements
    CrudController<
      ResourceGetResponse<UserObject>,
      ResourceCreateResponse<UserObject>,
      ResourceListResponse<UserObject>,
      ResourceDeleteResponse
    >
{
  async get(
    request: FastifyRequest<{ Params: UserParameters }>,
    _reply: FastifyReply,
  ): Promise<ResourceGetResponse<UserObject>> {
    const context = getExecutionContext(request);

    let id = request.params.id;
    if (request.params.id === "me") {
      id = context.user.id;
    }

    const user = await gr.services.users.get({ id: id });

    if (!user) {
      throw CrudException.notFound(`User ${id} not found`);
    }

    const userObject = await formatUser(user, {
      includeCompanies: context.user.id === id,
    });

    return {
      resource: userObject,
      websocket: context.user.id
        ? gr.platformServices.realtime.sign(getUserRooms(user), context.user.id)[0]
        : undefined,
    };
  }

  async save(
    request: FastifyRequest<{ Body: { resource: Partial<UserObject> }; Params: UserParameters }>,
    reply: FastifyReply,
  ): Promise<ResourceCreateResponse<UserObject>> {
    const context = getExecutionContext(request);

    const user = await gr.services.users.get({ id: context.user.id });
    if (!user) {
      reply.notFound(`User ${context.user.id} not found`);
      return;
    }

    user.status_icon = coalesce(request.body.resource, user.status_icon);

    await gr.services.users.save(user, context);

    return {
      resource: await formatUser(user),
    };
  }

  async setPreferences(
    request: FastifyRequest<{ Body: User["preferences"] }>,
  ): Promise<User["preferences"]> {
    const preferences = await gr.services.users.setPreferences(
      { id: request.currentUser.id },
      request.body,
    );
    return preferences;
  }

  async list(
    request: FastifyRequest<{ Querystring: UserListQueryParameters }>,
  ): Promise<ResourceListResponse<UserObject>> {
    const context = getExecutionContext(request);

    const userIds = request.query.user_ids ? request.query.user_ids.split(",") : [];

    let users: ListResult<User>;
    if (request.query.search) {
      users = await gr.services.users.search(
        new Pagination(request.query.page_token, request.query.limit),
        {
          search: request.query.search,
          companyId: request.query.search_company_id,
        },
        context,
      );
    } else {
      users = await gr.services.users.list(
        new Pagination(request.query.page_token, request.query.limit),
        { userIds },
        context,
      );
    }

    const resUsers = await Promise.all(
      users.getEntities().map(user =>
        formatUser(user, {
          includeCompanies: request.query.include_companies,
        }),
      ),
    );

    // return users;
    return {
      resources: resUsers,
      websockets: gr.platformServices.realtime.sign([], context.user.id),
    };
  }

  async all(
    request: FastifyRequest<{
      Querystring: UserListQueryParameters;
      Params: CompanyUsersParameters;
    }>,
  ): Promise<ResourceListResponse<UserObject>> {
    const companyId = request.params.companyId;

    const users = await gr.services.users.search(
      new Pagination(request.query.page_token, request.query.limit),
      {
        search: "",
        companyId,
      },
    );

    const resUsers = await Promise.all(
      users.getEntities().map(user =>
        formatUser(user, {
          includeCompanies: true,
        }),
      ),
    );

    // return users;
    return {
      resources: resUsers,
    };
  }

  async getUserCompanies(
    request: FastifyRequest<{ Params: UserParameters }>,
    _reply: FastifyReply,
  ): Promise<ResourceListResponse<CompanyObject>> {
    const context = getExecutionContext(request);

    const user = await gr.services.users.get({ id: request.params.id });

    if (!user) {
      throw CrudException.notFound(`User ${request.params.id} not found`);
    }

    const [currentUserCompanies, requestedUserCompanies] = await Promise.all(
      [context.user.id, request.params.id].map(userId =>
        gr.services.users.getUserCompanies({ id: userId }),
      ),
    );

    const currentUserCompaniesIds = new Set(currentUserCompanies.map(a => a.group_id));

    const companiesCache = new Map<string, Company>();
    const retrieveCompanyCached = async (companyId: string): Promise<Company> => {
      const company =
        companiesCache.get(companyId) ||
        (await gr.services.companies.getCompany({ id: companyId }));
      companiesCache.set(companyId, company);
      return company;
    };

    const combos = (await Promise.all(
      requestedUserCompanies
        .filter(a => currentUserCompaniesIds.has(a.group_id))
        .map((uc: CompanyUser) =>
          retrieveCompanyCached(uc.group_id).then(async (c: Company) => [
            c,
            uc,
            getCompanyStats(c, await gr.services.statistics.get(c.id, "messages")),
          ]),
        ),
    )) as [Company, CompanyUserObject, CompanyStatsObject][];

    return {
      resources: combos.map(combo => formatCompany(...combo)),
      websockets: gr.platformServices.realtime.sign([], context.user.id),
    };
  }

  async getCompany(
    request: FastifyRequest<{ Params: CompanyParameters }>,
    _reply: FastifyReply,
  ): Promise<ResourceGetResponse<CompanyObject>> {
    const company = await gr.services.companies.getCompany({ id: request.params.id });
    const context = getExecutionContext(request);

    if (!company) {
      throw CrudException.notFound(`Company ${request.params.id} not found`);
    }

    let companyUserObj: CompanyUserObject | null = null;
    if (context?.user?.id) {
      const companyUser = await gr.services.companies.getCompanyUser(company, {
        id: context.user.id,
      });
      companyUserObj = {
        company: company,
        role: companyUser.role,
        status: "active",
      };
    }

    return {
      resource: formatCompany(
        company,
        companyUserObj,
        getCompanyStats(company, await gr.services.statistics.get(company.id, "messages")),
      ),
      websocket: context.user?.id
        ? gr.platformServices.realtime.sign(getCompanyRooms(company), context.user.id)[0]
        : undefined,
    };
  }

  async registerUserDevice(
    request: FastifyRequest<{ Body: RegisterDeviceBody }>,
    _reply: FastifyReply,
  ): Promise<ResourceGetResponse<RegisterDeviceParams>> {
    const resource = request.body.resource;
    if (resource.type !== "FCM") {
      throw CrudException.badRequest("Type should be FCM only");
    }
    const context = getExecutionContext(request);

    await gr.services.users.registerUserDevice(
      { id: context.user.id },
      resource.value,
      resource.type,
      resource.version,
    );

    return {
      resource: request.body.resource,
    };
  }

  async getRegisteredDevices(
    request: FastifyRequest<{ Params: UserParameters }>,
    _reply: FastifyReply,
  ): Promise<ResourceListResponse<RegisterDeviceParams>> {
    const context = getExecutionContext(request);

    const userDevices = await gr.services.users.getUserDevices({ id: context.user.id });

    return {
      resources: userDevices.map(
        ud => ({ type: ud.type, value: ud.id, version: ud.version } as RegisterDeviceParams),
      ),
    };
  }

  async deregisterUserDevice(
    request: FastifyRequest<{ Params: DeregisterDeviceParams }>,
    reply: FastifyReply,
  ): Promise<ResourceDeleteResponse> {
    const context = getExecutionContext(request);
    const userDevices = await gr.services.users.getUserDevices({ id: context.user.id });
    const device = await userDevices.find(ud => ud.id == request.params.value);
    if (device) {
      await gr.services.users.deregisterUserDevice(device.id);
    }
    reply.status(204);
    return {
      status: "success",
    };
  }

  async recent(
    _request: FastifyRequest<{ Params: CompanyParameters; Querystring: { limit: 100 } }>,
    _reply: FastifyReply,
  ): Promise<ResourceListResponse<UserObject>> {
    return {
      resources: [],
    };
  }

  async qouta(
    request: FastifyRequest<{
      Params: UserParameters;
      Querystring: CompanyUsersParameters;
    }>,
    _reply: FastifyReply,
  ): Promise<UserQuota> {
    const context = getExecutionContext(request);

    let id = request.params.id;
    if (request.params.id === "me") {
      id = context.user.id;
    }

    if (id != context.user.id) {
      //if admin or application wants to know user quota, it's not implemented yet
      throw new Error("Not implemented yes");
    }

    const quota = await gr.services.documents.documents.userQuota({
      ...context,
      company: { id: request.query.companyId || config.get("drive.defaultCompany") },
    });

    const total: number = config.has("drive.defaultUserQuota")
      ? config.get("drive.defaultUserQuota")
      : NaN;
    return {
      total: total,
      remaining: isNaN(total) ? NaN : total - quota,
      used: quota,
    } as UserQuota;
  }
}

function getExecutionContext(request: FastifyRequest): ExecutionContext {
  return {
    user: request.currentUser,
    url: request.url,
    method: request.routerMethod,
    transport: "http",
  };
}
