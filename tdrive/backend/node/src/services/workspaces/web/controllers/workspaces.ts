import { CrudController } from "../../../../core/platform/services/webserver/types";
import {
  ResourceCreateResponse,
  ResourceDeleteResponse,
  ResourceGetResponse,
  ResourceListResponse,
} from "../../../../utils/types";
import {
  UpdateWorkspaceBody,
  WorkspaceBaseRequest,
  WorkspaceInviteDomainBody,
  WorkspaceObject,
  WorkspaceRequest,
  WorkspacesListRequest,
} from "../types";
import { FastifyReply, FastifyRequest } from "fastify";
import Workspace from "../../entities/workspace";
import { WorkspaceExecutionContext } from "../../types";
import { plainToClass } from "class-transformer";
import { hasCompanyAdminLevel, hasCompanyMemberLevel } from "../../../../utils/company";
import { hasWorkspaceAdminLevel } from "../../../../utils/workspace";
import { getWorkspaceRooms } from "../../realtime";
import {
  CrudException,
  ExecutionContext,
} from "../../../../core/platform/framework/api/crud-service";
import CompanyUser from "../../../user/entities/company_user";
import gr from "../../../global-resolver";
import { getLogger, TdriveLogger } from "../../../../core/platform/framework";

export class WorkspacesCrudController
  implements
    CrudController<
      ResourceGetResponse<WorkspaceObject>,
      ResourceCreateResponse<WorkspaceObject>,
      ResourceListResponse<WorkspaceObject>,
      ResourceDeleteResponse
    >
{
  private logger: TdriveLogger;
  private getCompanyUserRole(companyId: string, userId: string, context?: ExecutionContext) {
    return gr.services.companies
      .getCompanyUser({ id: companyId }, { id: userId }, context)
      .then(a => (a ? a.role : null));
  }

  private getWorkspaceUserRole(workspaceId: string, userId: string, context?: ExecutionContext) {
    return gr.services.workspaces
      .getUser({ workspaceId, userId }, context)
      .then(a => (a ? a.role || "member" : null));
  }

  private getWorkspaceUsersCount(workspaceId: string, context?: ExecutionContext) {
    return gr.services.workspaces.getUsersCount(workspaceId, context);
  }

  private async formatWorkspace(
    workspace: Workspace,
    usersCount: number,
    userId?: string,
  ): Promise<WorkspaceObject> {
    const res: WorkspaceObject = {
      id: workspace.id,
      company_id: workspace.company_id,
      name: workspace.name,
      logo: workspace.logo,

      default: workspace.isDefault,
      archived: workspace.isArchived,

      stats: {
        created_at: workspace.dateAdded,
        total_members: usersCount,
      },

      preferences: workspace.preferences,
    };

    if (userId) {
      let role = await this.getWorkspaceUserRole(workspace.id, userId);
      if (role !== "moderator") {
        //Company admins should be workspace moderators automatically
        const companyUser: CompanyUser = await gr.services.companies.getCompanyUser(
          { id: workspace.company_id },
          { id: userId },
        );
        if (companyUser && hasCompanyAdminLevel(companyUser?.role)) {
          role = "moderator";
        }
      }
      res.role = role;
    }

    return res;
  }

  async thumbnail(
    request: FastifyRequest<{ Params: WorkspaceRequest }>,
    response: FastifyReply,
  ): Promise<void> {
    const data = await gr.services.workspaces.thumbnail(request.params.id);
    const filename = "thumbnail.png";

    response.header("Content-disposition", `inline; filename="${filename}"`);
    response.type("image/png");

    response.send(data.file);
  }

  async get(
    request: FastifyRequest<{ Params: WorkspaceRequest }>,
    _reply: FastifyReply,
  ): Promise<ResourceGetResponse<WorkspaceObject>> {
    const context = getExecutionContext(request);

    const workspace = await gr.services.workspaces.get({
      company_id: context.company_id,
      id: request.params.id,
    });

    if (!workspace) {
      throw CrudException.notFound(`Workspace ${request.params.id} not found`);
    }

    const workspaceUserRole = await this.getWorkspaceUserRole(request.params.id, context.user.id);
    if (!workspaceUserRole) {
      const companyUserRole = await this.getCompanyUserRole(context.company_id, context.user.id);
      if (companyUserRole !== "admin") {
        throw CrudException.forbidden(`You are not belong to workspace ${request.params.id}`);
      }
    }

    const count = await this.getWorkspaceUsersCount(workspace.id);
    return {
      resource: await this.formatWorkspace(workspace, count, context.user.id),
    };
  }

  async list(
    request: FastifyRequest<{ Params: WorkspacesListRequest }>,
  ): Promise<ResourceListResponse<WorkspaceObject>> {
    const context = getExecutionContext(request);

    const allCompanyWorkspaces = await gr.services.workspaces.getAllForCompany(context.company_id);

    const allUserWorkspaceRolesMap = await gr.services.workspaces
      .getAllForUser({ userId: context.user.id }, { id: context.company_id })
      .then(
        uws =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          new Map<string, any>(
            uws.map(uw => [
              uw.workspaceId,
              hasCompanyAdminLevel(uw.role) ? "moderator" : uw.role || "member",
            ]),
          ),
      );

    const userWorkspaces = allCompanyWorkspaces.filter(workspace =>
      allUserWorkspaceRolesMap.has(workspace.id.toString()),
    );

    return {
      resources: await Promise.all(
        userWorkspaces.map(async ws =>
          this.formatWorkspace(ws, await this.getWorkspaceUsersCount(ws.id), context.user.id),
        ),
      ),
      websockets: gr.platformServices.realtime.sign(getWorkspaceRooms(context), context.user.id),
    };
  }

  async save(
    request: FastifyRequest<{ Params: WorkspaceRequest; Body: UpdateWorkspaceBody }>,
    reply: FastifyReply,
  ): Promise<ResourceGetResponse<WorkspaceObject>> {
    const context = getExecutionContext(request);
    const companyUserRole = await this.getCompanyUserRole(context.company_id, context.user.id);

    if (!hasCompanyMemberLevel(companyUserRole)) {
      throw CrudException.forbidden(`You are not a member of company ${context.company_id}`);
    }

    if (!hasCompanyAdminLevel(companyUserRole) && request.params.id) {
      const workspaceUserRole = await this.getWorkspaceUserRole(request.params.id, context.user.id);
      const companyUserRole = await this.getCompanyUserRole(context.company_id, context.user.id);

      if (!hasWorkspaceAdminLevel(workspaceUserRole, companyUserRole)) {
        throw CrudException.forbidden("You are not a admin of workspace or company");
      }
    }

    const r = request.body.resource;
    const opt = request.body.options;

    const existedEntity = request.params.id
      ? await gr.services.workspaces.get({
          company_id: request.params.company_id,
          id: request.params.id,
        })
      : null;

    const entity = plainToClass(Workspace, {
      ...{
        name: r.name || existedEntity?.name,
        logo: r.logo || existedEntity?.logo,
        isDefault: r.default || existedEntity?.isDefault,
        isArchived: r.archived || existedEntity?.isArchived,
      },
      ...{
        group_id: request.params.company_id,
        id: request.params.id,
      },
    });

    const workspaceEntity = await gr.services.workspaces
      .save(entity, opt || {}, context)
      .then(a => a.entity);

    request.params.id ? reply.code(200) : reply.code(201);

    return {
      resource: await this.formatWorkspace(
        workspaceEntity,
        await this.getWorkspaceUsersCount(workspaceEntity.id),
        context.user.id,
      ),
    };
  }

  async delete(
    request: FastifyRequest<{ Params: WorkspaceRequest }>,
    reply: FastifyReply,
  ): Promise<ResourceDeleteResponse> {
    const context = getExecutionContext(request);

    await this.checkWorkspaceModeratorAccess(request, context);

    const deleteResult = await gr.services.workspaces.delete({
      id: request.params.id,
      company_id: context.company_id,
    });

    if (deleteResult.deleted) {
      reply.code(204);

      return {
        status: "success",
      };
    }

    return {
      status: "error",
    };
  }

  /**
   * Sets the invitation domain for the workspace.
   *
   * @param {FastifyRequest<{ Params: WorkspaceRequest; Body: WorkspaceInviteDomainBody }>} request - the request
   * @param {FastifyReply} _reply - the reply
   * @returns {Promise<{ status: string }>}
   */
  setInviteDomain = async (
    request: FastifyRequest<{ Params: WorkspaceRequest; Body: WorkspaceInviteDomainBody }>,
    _reply: FastifyReply,
  ): Promise<{ status: string }> => {
    const context = getExecutionContext(request);

    await this.checkWorkspaceModeratorAccess(request, context);

    try {
      const { company_id, id } = request.params;
      await gr.services.workspaces.setInviteDomain(
        { company_id, workspace_id: id },
        request.body.domain,
        context,
      );
    } catch (error) {
      throw CrudException.badRequest("Failed to set invitation domain");
    }

    return {
      status: "success",
    };
  };

  /**
   * Checks whether the current user have moderator access level to the workspace.
   *
   * @param {FastifyRequest<{ Params: WorkspaceRequest }>} request - the request
   * @param {WorkspaceExecutionContext} context - the workspace execution context
   */
  checkWorkspaceModeratorAccess = async (
    request: FastifyRequest<{ Params: WorkspaceRequest }>,
    context: WorkspaceExecutionContext,
  ): Promise<void> => {
    const workspaceUserRole = await this.getWorkspaceUserRole(request.params.id, context.user.id);
    const companyUserRole = await this.getCompanyUserRole(context.company_id, context.user.id);

    if (!hasWorkspaceAdminLevel(workspaceUserRole, companyUserRole)) {
      const companyUserRole = await this.getCompanyUserRole(context.company_id, context.user.id);
      if (companyUserRole !== "admin") {
        throw CrudException.forbidden("You are not a admin of workspace or company");
      }
    }
  };

  constructor() {
    this.logger = getLogger("Workspaces controller");
  }
}

function getExecutionContext(
  request: FastifyRequest<{ Params: WorkspaceBaseRequest }>,
): WorkspaceExecutionContext {
  return {
    user: request.currentUser,
    company_id: request.params.company_id,
    url: request.url,
    method: request.routeOptions.method,
    transport: "http",
  };
}
