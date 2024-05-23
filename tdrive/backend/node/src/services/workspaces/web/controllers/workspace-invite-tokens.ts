import { CrudController } from "../../../../core/platform/services/webserver/types";
import {
  ResourceCreateResponse,
  ResourceDeleteResponse,
  ResourceGetResponse,
  ResourceListResponse,
} from "../../../../utils/types";
import {
  WorkspaceInviteTokenBody,
  WorkspaceInviteTokenDeleteRequest,
  WorkspaceInviteTokenGetRequest,
  WorkspaceInviteTokenObject,
  WorkspaceJoinByTokenRequest,
  WorkspaceJoinByTokenResponse,
} from "../types";
import { FastifyReply, FastifyRequest } from "fastify";

import { WorkspaceInviteTokensExecutionContext } from "../../types";
import { CrudException } from "../../../../core/platform/framework/api/crud-service";
import { pick } from "lodash";
import { ConsoleCompany } from "../../../console/types";
import { formatCompany, getCompanyStats } from "../../../../services/user/utils";
import gr from "../../../global-resolver";

export class WorkspaceInviteTokensCrudController
  implements
    CrudController<
      ResourceGetResponse<WorkspaceInviteTokenObject>,
      ResourceCreateResponse<WorkspaceInviteTokenObject>,
      ResourceListResponse<WorkspaceInviteTokenObject>,
      ResourceDeleteResponse
    >
{
  async list(
    request: FastifyRequest<{ Params: WorkspaceInviteTokenGetRequest }>,
    _reply: FastifyReply,
  ): Promise<ResourceListResponse<WorkspaceInviteTokenObject>> {
    const context = getExecutionContext(request);

    const res = await gr.services.workspaces.getInviteToken(
      context.company_id,
      context.workspace_id,
      context.user.id,
    );

    if (!res) {
      throw CrudException.notFound("Invite token not found");
    }

    return {
      resources: [{ token: res.token }],
    };
  }

  async save(
    request: FastifyRequest<{
      Params: WorkspaceInviteTokenGetRequest;
      Body: WorkspaceInviteTokenBody;
    }>,
    _reply: FastifyReply,
  ): Promise<ResourceGetResponse<WorkspaceInviteTokenObject>> {
    const context = getExecutionContext(request);

    const res = await gr.services.workspaces.createInviteToken(
      context.company_id,
      context.workspace_id,
      context.user.id,
      request.body.channels,
    );

    return {
      resource: { token: res.token },
    };
  }

  async delete(
    request: FastifyRequest<{ Params: WorkspaceInviteTokenDeleteRequest }>,
    reply: FastifyReply,
  ): Promise<ResourceDeleteResponse> {
    const context = getExecutionContext(request);

    const tokenInfo = gr.services.workspaces.decodeInviteToken(request.params.token);

    if (!tokenInfo) {
      throw CrudException.notFound("Invite token malformed");
    }

    const deleted = await gr.services.workspaces.deleteInviteToken(
      context.company_id,
      context.workspace_id,
      context.user.id,
    );

    if (!deleted) {
      throw CrudException.notFound("Invite token not found");
    }

    reply.code(204);

    return {
      status: "success",
    };
  }

  async join(
    request: FastifyRequest<{ Body: WorkspaceJoinByTokenRequest }>,
    _reply: FastifyReply,
  ): Promise<ResourceGetResponse<WorkspaceJoinByTokenResponse>> {
    const entity = await gr.services.workspaces.getInviteTokenInfo(request.body.token);

    if (!entity) {
      throw CrudException.notFound("Token not found");
    }

    const { company_id, workspace_id } = entity;

    const [company, workspace] = await Promise.all([
      gr.services.companies.getCompany({ id: company_id }),
      gr.services.workspaces.get({
        company_id: company_id,
        id: workspace_id,
      }),
    ]);
    const total_messages = await gr.services.statistics.get(company.id, "messages");

    const resource: WorkspaceJoinByTokenResponse = {
      company: {
        name: company.name,
        stats: formatCompany(company, undefined, getCompanyStats(company, total_messages))?.stats,
        plan: formatCompany(company, undefined, getCompanyStats(company, total_messages))?.plan,
      },
      workspace: { name: workspace.name },
      auth_required: false,
    };

    if (!request.currentUser) {
      resource.auth_required = true;
    } else {
      if (request.body.join) {
        const userId = request.currentUser.id;
        const user = await gr.services.users.get({ id: userId });

        const companyUser = await gr.services.companies.getCompanyUser(
          { id: company_id },
          { id: userId },
        );
        if (!companyUser) {
          const inviter = await gr.services.users.get({
            id: entity.user_id,
          });

          await gr.services.console
            .getClient()
            .addUserToCompany(
              { id: company.id, code: company.identity_provider_id } as ConsoleCompany,
              {
                id: userId,
                email: request.currentUser.email,
                password: null,
                firstName: null,
                lastName: null,
                name: null,
                avatar: {
                  type: null,
                  value: null,
                },
                role: "member",
                skipInvite: false,
                inviterEmail: inviter.email_canonical,
              },
            );
        }
        if (!companyUser) {
          throw CrudException.badRequest("Unable to add user to the company");
        }

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

        const workspaceUser = await gr.services.workspaces.getUser({
          workspaceId: workspace.id,
          userId: userId,
        });
        if (!workspaceUser) {
          await gr.services.workspaces.addUser(
            pick(workspace, ["company_id", "id"]),
            { id: userId },
            "member",
          );
        }

        resource.company.id = company.id;
        resource.workspace.id = workspace.id;
      }
    }

    return { resource };
  }
}

function getExecutionContext(
  request: FastifyRequest<{ Params: WorkspaceInviteTokenGetRequest }>,
): WorkspaceInviteTokensExecutionContext {
  return {
    user: request.currentUser,
    company_id: request.params.company_id,
    workspace_id: request.params.workspace_id,
    url: request.url,
    method: request.routeOptions.method,
    transport: "http",
  };
}
