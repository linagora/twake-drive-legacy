import { CrudController } from "../../../../core/platform/services/webserver/types";
import {
  ResourceCreateResponse,
  ResourceDeleteResponse,
  ResourceGetResponse,
  ResourceListResponse,
  uuid,
} from "../../../../utils/types";
import {
  WorkspacePendingUserRequest,
  WorkspaceUserInvitationResponse,
  WorkspaceUserInvitationResponseItem,
  WorkspaceUserObject,
  WorkspaceUsersAddBody,
  WorkspaceUsersBaseRequest,
  WorkspaceUsersInvitationItem,
  WorkspaceUsersInvitationRequestBody,
  WorkspaceUsersRequest,
} from "../types";
import { FastifyReply, FastifyRequest } from "fastify";

import { WorkspaceUsersExecutionContext } from "../../types";
import WorkspaceUser from "../../entities/workspace_user";
import User from "../../../user/entities/user";
import CompanyUser from "../../../user/entities/company_user";
import { CompanyShort, CompanyUserRole, CompanyUserStatus } from "../../../user/web/types";
import Company from "../../../user/entities/company";
import { chain } from "lodash";
import {
  CrudException,
  ListResult,
  Pagination,
} from "../../../../core/platform/framework/api/crud-service";
import WorkspacePendingUser from "../../entities/workspace_pending_users";
import { ConsoleCompany, CreateConsoleUser } from "../../../console/types";
import { hasCompanyAdminLevel } from "../../../../utils/company";
import gr from "../../../global-resolver";

export class WorkspaceUsersCrudController
  implements
    CrudController<
      ResourceGetResponse<WorkspaceUserObject>,
      ResourceCreateResponse<WorkspaceUserObject>,
      ResourceListResponse<WorkspaceUserObject>,
      ResourceDeleteResponse
    >
{
  private formatWorkspaceUser(
    workspaceUser: WorkspaceUser,
    currentCompanyId: uuid,
    user: User,
    userCompanies: CompanyUser[],
    companiesMap: Map<string, Company>,
  ): WorkspaceUserObject {
    //Company admins should be workspace moderators automatically
    if (
      currentCompanyId &&
      userCompanies &&
      hasCompanyAdminLevel(userCompanies.find(uc => uc.group_id === currentCompanyId)?.role)
    ) {
      workspaceUser.role = "moderator";
    }

    const res: WorkspaceUserObject = {
      id: workspaceUser.id,
      company_id: currentCompanyId,
      user_id: workspaceUser.userId,
      workspace_id: workspaceUser.workspaceId,
      created_at: workspaceUser.dateAdded,
      role: workspaceUser.role || "member",
      user: {
        id: user.id,
        provider: user.identity_provider,
        provider_id: user.identity_provider_id,
        email: user.email_canonical,
        username: user.username_canonical,
        is_verified: Boolean(user.mail_verified),
        picture: user.picture,
        first_name: user.first_name,
        last_name: user.last_name,
        full_name: [user.first_name, user.last_name].join(" "),
        created_at: user.creation_date,
        deleted: Boolean(user.deleted),
        status: user.status_icon,
        last_activity: user.last_activity,
        cache: {
          companies: user.cache?.companies || [],
        },
        companies: userCompanies
          .filter(cu => companiesMap.get(cu.group_id))
          .map(cu => {
            const company = companiesMap.get(cu.group_id);
            return {
              role: (cu.role as CompanyUserRole) || "guest",
              status: "active" as CompanyUserStatus, // FIXME: with real status
              company: {
                id: company.id,
                name: company.name,
                logo: company.logo,
              } as CompanyShort,
            };
          }),
      },
    };

    return res;
  }

  private async getCompaniesMap(companyUsers: CompanyUser[]) {
    const companiesMap: Map<string, Company> = new Map(
      (
        await Promise.all(
          chain(companyUsers)
            .map("group_id")
            .uniq()
            .value()
            .map(companyId => gr.services.companies.getCompany({ id: companyId })),
        )
      )
        .filter(c => c)
        .map(c => [c.id, c]),
    );
    return companiesMap;
  }

  async list(
    request: FastifyRequest<{
      Params: WorkspaceUsersBaseRequest;
      Querystring: { search?: string; page_token?: string; limit?: string };
    }>,
    _reply: FastifyReply,
  ): Promise<ResourceListResponse<WorkspaceUserObject>> {
    const context = getExecutionContext(request);
    let nextPageToken: string | null = null;

    let allWorkspaceUsers: WorkspaceUser[] = [];
    if (request.query.search) {
      const users: ListResult<User> = await gr.services.users.search(
        new Pagination(request.query.page_token, request.query.limit),
        {
          search: request.query.search,
          companyId: context.company_id,
        },
        context,
      );

      nextPageToken = users.nextPage?.page_token;

      for (const user of users.getEntities()) {
        const res = await gr.services.workspaces.getUser({
          workspaceId: context.workspace_id,
          userId: user.id,
        });

        if (res) allWorkspaceUsers.push(res);
      }
    } else {
      const result = await gr.services.workspaces.getUsers(
        {
          workspaceId: context.workspace_id,
        },
        new Pagination(request.query.page_token, request.query.limit),
      );

      allWorkspaceUsers = result.getEntities();

      nextPageToken = result.page_token;
    }

    const allUsersMap = new Map(
      (
        await Promise.all(
          allWorkspaceUsers.map(wu => gr.services.users.get({ id: wu.userId })),
        ).then(users => users.filter(a => a))
      ).map(user => [user.id, user]),
    );

    const allCompanyUsers: CompanyUser[] = [].concat(
      ...(await Promise.all(
        allWorkspaceUsers.map(wu => gr.services.users.getUserCompanies({ id: wu.userId })),
      )),
    );

    const companyUsersMap = new Map<string, Set<CompanyUser>>();

    for (const companyUser of allCompanyUsers) {
      if (!companyUsersMap.has(companyUser.user_id)) {
        companyUsersMap.set(companyUser.user_id, new Set());
      }
      companyUsersMap.get(companyUser.user_id).add(companyUser);
    }

    const companiesMap = await this.getCompaniesMap(allCompanyUsers);

    const resources = allWorkspaceUsers
      .filter(wu => allUsersMap.get(wu.userId))
      .map(async wu =>
        this.formatWorkspaceUser(
          wu,
          context.company_id,
          allUsersMap.get(wu.userId),
          Array.from(companyUsersMap.get(wu.userId) || []),
          companiesMap,
        ),
      );

    return {
      resources: await Promise.all(resources),
      next_page_token: nextPageToken,
    };
  }

  private async getForOne(
    userId: uuid,
    context: WorkspaceUsersExecutionContext,
  ): Promise<WorkspaceUserObject> {
    const workspaceUser = await gr.services.workspaces.getUser({
      workspaceId: context.workspace_id,
      userId: userId,
    });

    const user = await gr.services.users.get({ id: userId });

    if (!user) {
      throw CrudException.badRequest("User entity not found");
    }

    const userCompanies: CompanyUser[] = await gr.services.users.getUserCompanies({ id: userId });

    const companiesMap = await this.getCompaniesMap(userCompanies);

    return this.formatWorkspaceUser(
      workspaceUser,
      context.company_id,
      user,
      userCompanies,
      companiesMap,
    );
  }

  async get(
    request: FastifyRequest<{ Params: WorkspaceUsersRequest }>,
    _reply: FastifyReply,
  ): Promise<ResourceGetResponse<WorkspaceUserObject>> {
    const context = getExecutionContext(request);

    const resource = await this.getForOne(context.user.id, context);

    return {
      resource,
    };
  }

  async save(
    request: FastifyRequest<{ Body: WorkspaceUsersAddBody; Params: WorkspaceUsersRequest }>,
    reply: FastifyReply,
  ): Promise<ResourceGetResponse<WorkspaceUserObject>> {
    const context = getExecutionContext(request);
    const userId = request.params.user_id || request.body.resource.user_id;
    const role = request.body.resource.role;

    const companyUser = await gr.services.companies.getCompanyUser(
      { id: context.company_id },
      { id: userId },
    );

    if (!companyUser) {
      throw CrudException.badRequest(`User ${userId} does not belong to this company`);
    }

    const workspaceUser = await gr.services.workspaces.getUser({
      workspaceId: context.workspace_id,
      userId: userId,
    });

    if (request.params.user_id) {
      // ON UPDATE
      if (!workspaceUser) {
        throw CrudException.notFound(`User ${userId} not found in this workspace`);
      }
      await gr.services.workspaces.updateUserRole(
        { workspaceId: context.workspace_id, userId },
        role,
      );
    } else {
      // ON ADD
      if (!workspaceUser) {
        await gr.services.workspaces.addUser(
          { id: context.workspace_id, company_id: context.company_id },
          { id: userId },
          role,
        );
      }

      const user = await gr.services.users.get({
        id: userId,
      });

      if (user) {
        const userEmailDomain = user.email_canonical.split("@").pop();
        const inviteDomainEntries = await gr.services.workspaces.getInviteDomainWorkspaces(
          userEmailDomain,
        );

        inviteDomainEntries.map(async entry => {
          const workspace = await gr.services.workspaces.get({
            company_id: entry.company_id,
            id: entry.workspace_id,
          });

          if (!workspace) {
            return;
          }

          if (
            !workspace.preferences.invite_domain ||
            workspace.preferences.invite_domain !== userEmailDomain
          ) {
            return;
          }

          const existingUser = await gr.services.workspaces.getUser({
            userId,
            workspaceId: entry.workspace_id,
          });

          if (existingUser) {
            return;
          }

          await gr.services.workspaces.addUser(
            {
              company_id: entry.company_id,
              id: entry.workspace_id,
            },
            { id: userId },
            "member",
          );
        });
      }
    }

    const resource = await this.getForOne(userId, context);

    reply.status(201);

    return {
      resource: resource,
    };
  }

  async delete(
    request: FastifyRequest<{ Params: WorkspaceUsersRequest }>,
    reply: FastifyReply,
  ): Promise<ResourceDeleteResponse> {
    const context = getExecutionContext(request);

    const workspaceUser = await gr.services.workspaces.getUser({
      workspaceId: context.workspace_id,
      userId: request.params.user_id,
    });

    if (!workspaceUser) {
      throw CrudException.notFound("Default channel has not been found");
    }

    await gr.services.workspaces.removeUser(
      {
        workspaceId: context.workspace_id,
        userId: request.params.user_id,
      },
      request.params.company_id,
    );

    reply.status(204);
    return {
      status: "success",
    };
  }

  async invite(
    request: FastifyRequest<{
      Body: WorkspaceUsersInvitationRequestBody;
      Params: WorkspaceUsersRequest;
    }>,
    _reply: FastifyReply,
  ): Promise<WorkspaceUserInvitationResponse> {
    const context = getExecutionContext(request);

    const usersInTdrive: Map<string, User> = new Map(
      await gr.services.users
        .getByEmails(request.body.invitations.map(a => a.email))
        .then(users => users.map(user => [user.email_canonical, user])),
    );

    const workspacePendingUsers: Map<string, WorkspacePendingUser> = new Map(
      await gr.services.workspaces
        .getPendingUsers({
          workspace_id: context.workspace_id,
        })
        .then(pendingUsers => pendingUsers.map(pendingUser => [pendingUser.email, pendingUser])),
    );

    const responses: WorkspaceUserInvitationResponseItem[] = [];

    const putUserToPending = async (invitation: WorkspaceUsersInvitationItem) => {
      await gr.services.workspaces.addPendingUser(
        {
          workspace_id: context.workspace_id,
          email: invitation.email,
        },
        invitation.role,
        invitation.company_role,
      );
      responses.push({ email: invitation.email, status: "ok" });
    };

    const usersToProcessImmediately = [];

    for (const invitation of request.body.invitations) {
      if (workspacePendingUsers.has(invitation.email)) {
        responses.push({
          email: invitation.email,
          status: "error",
          message: "Pending user already exists",
        });
        continue;
      }

      let userInCompany = false;
      let user: User = null;

      const consoleClient = gr.services.console.getClient();

      if (usersInTdrive.has(invitation.email)) {
        user = usersInTdrive.get(invitation.email);
        usersToProcessImmediately.push(user);

        if (user) {
          userInCompany = Boolean(
            await gr.services.companies.getCompanyUser({ id: context.company_id }, { id: user.id }),
          );
        }
      } else {
        user = await consoleClient.addUserToTdrive({
          email: invitation.email,
          password: invitation.password,
        });
      }

      if (!userInCompany) {
        const company = await gr.services.companies.getCompany({
          id: context.company_id,
        });
        const createUser: CreateConsoleUser = {
          id: user ? user.id : null,
          email: invitation.email,
          firstName: null,
          lastName: null,
          name: null,
          avatar: {
            type: null,
            value: null,
          },
          password: invitation.password,
          role: invitation.company_role || "guest",
          skipInvite: false,
          inviterEmail: context.user.email,
        };

        try {
          await consoleClient.addUserToCompany(
            { id: company.id, code: company.identity_provider_id } as ConsoleCompany,
            createUser,
          );
        } catch (err) {
          responses.push({
            email: invitation.email,
            status: "error",
            message: "Unable to invite this user to your company " + err,
          });
          continue;
        }
      }

      const userInWorkspace = Boolean(
        user &&
          (await gr.services.workspaces.getUser({
            workspaceId: context.workspace_id,
            userId: user.id,
          })),
      );

      if (userInWorkspace) {
        responses.push({
          email: invitation.email,
          status: "error",
          message: "User is already in workspace",
        });
      } else {
        await putUserToPending(invitation);
      }
    }

    await Promise.all(
      usersToProcessImmediately.map(user => {
        gr.services.console.processPendingUser(user);
      }),
    );

    return {
      resources: responses,
    };
  }

  async deletePending(
    request: FastifyRequest<{ Params: WorkspacePendingUserRequest }>,
    _reply: FastifyReply,
  ): Promise<ResourceDeleteResponse> {
    try {
      await gr.services.workspaces.removePendingUser({
        workspace_id: request.params.workspace_id,
        email: request.params.email,
      });

      return { status: "success" };
    } catch (e) {
      console.error(e);
      return {
        status: "error",
      };
    }
  }

  async listPending(
    request: FastifyRequest<{ Params: WorkspacePendingUserRequest }>,
    _reply: FastifyReply,
  ): Promise<ResourceListResponse<WorkspaceUsersInvitationItem>> {
    const resources = await gr.services.workspaces.getPendingUsers({
      workspace_id: request.params.workspace_id,
    });

    return {
      resources,
    };
  }
}

function getExecutionContext(
  request: FastifyRequest<{ Params: WorkspaceUsersBaseRequest }>,
): WorkspaceUsersExecutionContext {
  return {
    user: request.currentUser,
    company_id: request.params.company_id,
    workspace_id: request.params.workspace_id,
    url: request.url,
    method: request.routeOptions.method,
    transport: "http",
  };
}
