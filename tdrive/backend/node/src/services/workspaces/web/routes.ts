import { FastifyInstance, FastifyPluginCallback, FastifyRequest } from "fastify";
import { WorkspacesCrudController } from "./controllers/workspaces";
import {
  createWorkspaceSchema,
  createWorkspaceUserSchema,
  deleteWorkspaceInviteTokenSchema,
  deleteWorkspacePendingUsersSchema,
  deleteWorkspaceUserSchema,
  getWorkspaceInviteTokenSchema,
  getWorkspacePendingUsersSchema,
  getWorkspaceSchema,
  getWorkspacesSchema,
  getWorkspaceUserSchema,
  getWorkspaceUsersSchema,
  inviteWorkspaceUserSchema,
  joinInviteTokenSchema,
  postWorkspaceInviteTokenSchema,
  updateWorkspaceSchema,
  updateWorkspaceUserSchema,
} from "./schemas";
import {
  WorkspaceBaseRequest,
  WorkspaceInviteDomainBody,
  WorkspaceRequest,
  WorkspaceUsersRequest,
} from "./types";
import { WorkspaceUsersCrudController } from "./controllers/workspace-users";
import { hasWorkspaceAdminLevel, hasWorkspaceMemberLevel } from "../../../utils/workspace";
import { WorkspaceInviteTokensCrudController } from "./controllers/workspace-invite-tokens";
import WorkspaceUser from "../entities/workspace_user";
import { checkUserBelongsToCompany, hasCompanyMemberLevel } from "../../../utils/company";
import gr from "../../global-resolver";
import freeEmailDomains from "free-email-domains";

const workspacesUrl = "/companies/:company_id/workspaces";
const workspacePendingUsersUrl = "/companies/:company_id/workspaces/:workspace_id/pending";
const workspaceUsersUrl = "/companies/:company_id/workspaces/:workspace_id/users";
const workspaceInviteTokensUrl = "/companies/:company_id/workspaces/:workspace_id/users/tokens";

const routes: FastifyPluginCallback = (fastify: FastifyInstance, options, next) => {
  const workspacesController = new WorkspacesCrudController();
  const workspaceUsersController = new WorkspaceUsersCrudController();
  const workspaceInviteTokensController = new WorkspaceInviteTokensCrudController();

  const accessControl = async () => {
    // TODO
    const authorized = true;

    if (!authorized) {
      throw fastify.httpErrors.badRequest("Invalid company/workspace");
    }
  };

  const companyCheck = async (request: FastifyRequest) => {
    await checkUserBelongsToCompany(
      request.currentUser.id,
      (request.params as WorkspaceBaseRequest).company_id,
    );
  };

  const checkWorkspace = async (request: FastifyRequest) => {
    const params = request.params as WorkspaceUsersRequest;
    const workspace = await gr.services.workspaces.get({
      company_id: params.company_id,
      id: params.workspace_id,
    });
    if (!workspace) {
      throw fastify.httpErrors.notFound(`Workspace ${params.workspace_id} not found`);
    }
  };

  const checkUserWorkspace = async (request: FastifyRequest): Promise<WorkspaceUser> => {
    const params = request.params as WorkspaceUsersRequest;
    const companyId = params.workspace_id;
    const workspaceId = params.workspace_id;
    const userId = request.currentUser.id;
    const workspaceUser = await gr.services.workspaces.getUser({
      workspaceId,
      userId,
    });

    if (!workspaceUser) {
      const workspace = await gr.services.workspaces.get({
        company_id: companyId,
        id: workspaceId,
      });
      if (!workspace) {
        throw fastify.httpErrors.notFound(`Workspace ${workspaceId} not found`);
      } else {
        throw fastify.httpErrors.forbidden("Not member of the workspace");
      }
    }
    return workspaceUser;
  };

  const checkUserHasCompanyMemberLevel = async (request: FastifyRequest) => {
    if (!request.currentUser.id) {
      throw fastify.httpErrors.forbidden("You must be authenticated");
    }
    const companyUser = await gr.services.companies.getCompanyUser(
      { id: (request.params as WorkspaceUsersRequest).company_id },
      { id: request.currentUser.id },
    );

    if (!hasCompanyMemberLevel(companyUser?.role)) {
      throw fastify.httpErrors.forbidden("Only company member can perform this action");
    }
  };

  const checkUserIsWorkspaceAdmin = async (request: FastifyRequest) => {
    if (!request.currentUser.id) {
      throw fastify.httpErrors.forbidden("You must be authenticated");
    }
    const workspaceUser = await checkUserWorkspace(request);
    const params = request.params as WorkspaceUsersRequest;
    const companyUser = await gr.services.companies.getCompanyUser(
      { id: params.company_id },
      { id: request.currentUser.id },
    );
    if (!hasWorkspaceAdminLevel(workspaceUser?.role, companyUser?.role)) {
      throw fastify.httpErrors.forbidden("Only workspace moderator can perform this action");
    }
  };

  const checkUserIsWorkspaceMember = async (request: FastifyRequest) => {
    if (!request.currentUser.id) {
      throw fastify.httpErrors.forbidden("You must be authenticated");
    }
    const workspaceUser = await checkUserWorkspace(request);
    const companyUser = await gr.services.companies.getCompanyUser(
      { id: (request.params as WorkspaceUsersRequest).company_id },
      { id: request.currentUser.id },
    );
    if (!hasWorkspaceMemberLevel(workspaceUser?.role, companyUser?.role)) {
      throw fastify.httpErrors.forbidden("Only workspace members can perform this action");
    }
  };

  const validateDomain = async (
    request: FastifyRequest<{ Params: WorkspaceRequest; Body: WorkspaceInviteDomainBody }>,
  ) => {
    const { domain } = request.body;

    if (
      /^((?!-))(xn--)?[a-z0-9][a-z0-9-_]{0,61}[a-z0-9]{0,1}\.(xn--)?([a-z0-9\-]{1,61}|[a-z0-9-]{1,30}\.[a-z]{2,})$/.test(
        domain,
      ) === false
    ) {
      throw fastify.httpErrors.badRequest("invalid domain");
    }

    if (freeEmailDomains.includes(domain)) {
      throw fastify.httpErrors.badRequest("invalid email provider");
    }
  };

  fastify.route({
    method: "GET",
    url: `${workspacesUrl}`,
    preHandler: [accessControl, companyCheck],
    preValidation: fastify.authenticate,
    schema: getWorkspacesSchema,
    handler: workspacesController.list.bind(workspacesController),
  });

  fastify.route({
    method: "GET",
    url: `${workspacesUrl}/:id`,
    preHandler: [accessControl, companyCheck],
    preValidation: fastify.authenticate,
    schema: getWorkspaceSchema,
    handler: workspacesController.get.bind(workspacesController),
  });

  fastify.route({
    method: "GET",
    url: `${workspacesUrl}/:id/thumbnail`,
    handler: workspacesController.thumbnail.bind(workspacesController),
  });

  fastify.route({
    method: "POST",
    url: `${workspacesUrl}`,
    preHandler: [accessControl, companyCheck],
    preValidation: fastify.authenticate,
    schema: createWorkspaceSchema,
    handler: workspacesController.save.bind(workspacesController),
  });

  fastify.route({
    method: "POST",
    url: `${workspacesUrl}/:id`,
    preHandler: [accessControl, companyCheck],
    preValidation: fastify.authenticate,
    schema: updateWorkspaceSchema,
    handler: workspacesController.save.bind(workspacesController),
  });

  fastify.route({
    method: "DELETE",
    url: `${workspacesUrl}/:id`,
    preHandler: [accessControl, companyCheck],
    preValidation: fastify.authenticate,
    handler: workspacesController.delete.bind(workspacesController),
  });

  fastify.route({
    method: "POST",
    url: `${workspacesUrl}/:id/invite_domain`,
    preHandler: [validateDomain, companyCheck],
    preValidation: fastify.authenticate,
    handler: workspacesController.setInviteDomain.bind(workspacesController),
  });

  fastify.route({
    method: "GET",
    url: `${workspaceUsersUrl}`,
    preHandler: [accessControl, companyCheck, checkWorkspace],
    preValidation: fastify.authenticate,
    schema: getWorkspaceUsersSchema,
    handler: workspaceUsersController.list.bind(workspaceUsersController),
  });

  fastify.route({
    method: "GET",
    url: `${workspaceUsersUrl}/:user_id`,
    preHandler: [accessControl, companyCheck, checkWorkspace],
    preValidation: fastify.authenticate,
    schema: getWorkspaceUserSchema,
    handler: workspaceUsersController.get.bind(workspaceUsersController),
  });

  fastify.route({
    method: "POST",
    url: `${workspaceUsersUrl}`,
    preHandler: [accessControl, companyCheck, checkUserIsWorkspaceAdmin],
    preValidation: fastify.authenticate,
    schema: createWorkspaceUserSchema,
    handler: workspaceUsersController.save.bind(workspaceUsersController),
  });

  fastify.route({
    method: "POST",
    url: `${workspaceUsersUrl}/:user_id`,
    preHandler: [accessControl, companyCheck, checkUserIsWorkspaceAdmin],
    preValidation: fastify.authenticate,
    schema: updateWorkspaceUserSchema,
    handler: workspaceUsersController.save.bind(workspaceUsersController),
  });

  fastify.route({
    method: "DELETE",
    url: `${workspaceUsersUrl}/:user_id`,
    preHandler: [accessControl, companyCheck, checkUserIsWorkspaceAdmin],
    preValidation: fastify.authenticate,
    schema: deleteWorkspaceUserSchema,
    handler: workspaceUsersController.delete.bind(workspaceUsersController),
  });

  fastify.route({
    method: "POST",
    url: `${workspaceUsersUrl}/invite`,
    preHandler: [
      accessControl,
      companyCheck,
      checkUserHasCompanyMemberLevel,
      checkUserIsWorkspaceMember,
    ],
    preValidation: fastify.authenticate,
    schema: inviteWorkspaceUserSchema,
    handler: workspaceUsersController.invite.bind(workspaceUsersController),
  });

  fastify.route({
    method: "DELETE",
    url: `${workspacePendingUsersUrl}/:email`,
    preHandler: [
      accessControl,
      companyCheck,
      checkUserHasCompanyMemberLevel,
      checkUserIsWorkspaceMember,
    ],
    preValidation: fastify.authenticate,
    schema: deleteWorkspacePendingUsersSchema,
    handler: workspaceUsersController.deletePending.bind(workspaceUsersController),
  });

  fastify.route({
    method: "GET",
    url: `${workspacePendingUsersUrl}`,
    preHandler: [
      accessControl,
      companyCheck,
      checkUserHasCompanyMemberLevel,
      checkUserIsWorkspaceMember,
    ],
    preValidation: fastify.authenticate,
    schema: getWorkspacePendingUsersSchema,
    handler: workspaceUsersController.listPending.bind(workspaceUsersController),
  });

  fastify.route({
    method: "GET",
    url: `${workspaceInviteTokensUrl}`,
    preHandler: [
      accessControl,
      companyCheck,
      checkUserIsWorkspaceMember,
      checkUserHasCompanyMemberLevel,
    ],
    preValidation: fastify.authenticate,
    schema: getWorkspaceInviteTokenSchema,
    handler: workspaceInviteTokensController.list.bind(workspaceInviteTokensController),
  });

  fastify.route({
    method: "POST",
    url: `${workspaceInviteTokensUrl}`,
    preHandler: [
      accessControl,
      companyCheck,
      checkUserIsWorkspaceMember,
      checkUserHasCompanyMemberLevel,
    ],
    preValidation: fastify.authenticate,
    schema: postWorkspaceInviteTokenSchema,
    handler: workspaceInviteTokensController.save.bind(workspaceInviteTokensController),
  });

  fastify.route({
    method: "DELETE",
    url: `${workspaceInviteTokensUrl}/:token`,
    preHandler: [
      accessControl,
      companyCheck,
      checkUserIsWorkspaceMember,
      checkUserHasCompanyMemberLevel,
    ],
    preValidation: fastify.authenticate,
    schema: deleteWorkspaceInviteTokenSchema,
    handler: workspaceInviteTokensController.delete.bind(workspaceInviteTokensController),
  });

  fastify.route({
    method: "POST",
    url: "/join",
    preHandler: [],
    preValidation: fastify.authenticateOptional,
    schema: joinInviteTokenSchema,
    handler: workspaceInviteTokensController.join.bind(workspaceInviteTokensController),
  });

  next();
};

export default routes;
