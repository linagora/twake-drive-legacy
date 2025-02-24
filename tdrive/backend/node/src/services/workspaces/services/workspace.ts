import { concat, EMPTY, from, Observable } from "rxjs";
import { mergeMap } from "rxjs/operators";
import {
  CreateResult,
  CrudException,
  DeleteResult,
  ExecutionContext,
  ListResult,
  OperationType,
  Paginable,
  Pagination,
  SaveResult,
} from "../../../core/platform/framework/api/crud-service";
import Repository from "../../../core/platform/services/database/services/orm/repository/repository";
import WorkspaceUser, {
  formatWorkspaceUser,
  getInstance as getWorkspaceUserInstance,
  TYPE as WorkspaceUserType,
  WorkspaceUserPrimaryKey,
} from "../../workspaces/entities/workspace_user";
import Workspace, {
  getInstance as getWorkspaceInstance,
  TYPE,
  TYPE as WorkspaceType,
  WorkspacePrimaryKey,
} from "../../workspaces/entities/workspace";
import { WorkspaceExecutionContext, WorkspaceUserRole } from "../types";
import User, { UserPrimaryKey } from "../../user/entities/user";
import { CompanyPrimaryKey } from "../../user/entities/company";
import _, { merge } from "lodash";
import WorkspacePendingUser, {
  TYPE as WorkspacePendingUserType,
  WorkspacePendingUserPrimaryKey,
} from "../entities/workspace_pending_users";
import { CompanyUserRole } from "../../user/web/types";
import { ResourceEventsPayload, uuid } from "../../../utils/types";
import { CounterProvider } from "../../../core/platform/services/counter/provider";
import {
  TYPE as WorkspaceCounterEntityType,
  WorkspaceCounterEntity,
  WorkspaceCounterPrimaryKey,
} from "../entities/workspace_counters";
import { countRepositoryItems } from "../../../utils/counters";
import { Initializable, TdriveServiceProvider } from "../../../core/platform/framework";
import { InviteTokenObject, WorkspaceInviteTokenObject } from "../web/types";
import WorkspaceInviteTokens, {
  getInstance as getWorkspaceInviteTokensInstance,
  TYPE as WorkspaceInviteTokensType,
  WorkspaceInviteTokensPrimaryKey,
} from "../entities/workspace_invite_tokens";
import { randomBytes } from "crypto";
import { Readable } from "stream";
import { expandUUID4, reduceUUID4 } from "../../../utils/uuid-reducer";
import gr from "../../global-resolver";
import { logger } from "@sentry/utils";
import { localEventBus } from "../../../core/platform/framework/event-bus";
import WorkspaceInviteDomain, {
  TYPE as WorkspaceInviteDomainType,
  getInstance as getWorkspaceInviteDomainInstance,
} from "../entities/workspace_invite_domain";

export class WorkspaceServiceImpl implements TdriveServiceProvider, Initializable {
  version: "1";
  private workspaceUserRepository: Repository<WorkspaceUser>;
  private workspaceRepository: Repository<Workspace>;
  private workspacePendingUserRepository: Repository<WorkspacePendingUser>;
  private workspaceCounter: CounterProvider<WorkspaceCounterEntity>;
  private workspaceInviteTokensRepository: Repository<WorkspaceInviteTokens>;
  private workspaceInviteDomainRepository: Repository<WorkspaceInviteDomain>;

  async init(): Promise<this> {
    this.workspaceUserRepository = await gr.database.getRepository<WorkspaceUser>(
      WorkspaceUserType,
      WorkspaceUser,
    );

    this.workspaceRepository = await gr.database.getRepository<Workspace>(WorkspaceType, Workspace);

    const workspaceCountersRepository = await gr.database.getRepository<WorkspaceCounterEntity>(
      WorkspaceCounterEntityType,
      WorkspaceCounterEntity,
    );

    this.workspacePendingUserRepository = await gr.database.getRepository<WorkspacePendingUser>(
      WorkspacePendingUserType,
      WorkspacePendingUser,
    );

    this.workspaceCounter = await gr.platformServices.counter.getCounter<WorkspaceCounterEntity>(
      workspaceCountersRepository,
    );

    this.workspaceCounter.setReviseCallback(async (pk: WorkspaceCounterPrimaryKey) => {
      if (pk.counter_type == "members") {
        return countRepositoryItems(this.workspaceUserRepository, { workspace_id: pk.id });
      }
      return 0;
    });

    this.workspaceInviteTokensRepository = await gr.database.getRepository<WorkspaceInviteTokens>(
      WorkspaceInviteTokensType,
      WorkspaceInviteTokens,
    );

    this.workspaceInviteDomainRepository = await gr.database.getRepository<WorkspaceInviteDomain>(
      WorkspaceInviteDomainType,
      WorkspaceInviteDomain,
    );

    //If user deleted from a company, remove it from all workspace
    localEventBus.subscribe<ResourceEventsPayload>("company:user:deleted", async data => {
      if (data?.user?.id && data?.company?.id)
        gr.services.workspaces.ensureUserNotInCompanyIsNotInWorkspace(data.user, data.company.id);
    });

    return this;
  }

  get(pk: WorkspacePrimaryKey, context?: ExecutionContext): Promise<Workspace> {
    return this.workspaceRepository.findOne(pk, {}, context);
  }

  // TODO: remove logic from context
  async create(workspace: Workspace, context?: ExecutionContext): Promise<CreateResult<Workspace>> {
    const workspaceToCreate: Workspace = getWorkspaceInstance({
      ...workspace,
      ...{
        name: await this.getWorkspaceName(workspace.name, workspace.company_id, workspace.id),
        dateAdded: Date.now(),
        isDeleted: false,
        isArchived: false,
      },
    });

    const userId = context?.user?.id || "";

    const created = await this.save(
      workspaceToCreate,
      {},
      { company_id: workspace.company_id, user: { id: userId, server_request: true } },
    );

    return new CreateResult<Workspace>(TYPE, created.entity);
  }

  async save<SaveOptions>(
    item: Partial<Workspace>,
    options?: SaveOptions & { logo_b64?: string },
    context?: WorkspaceExecutionContext,
  ): Promise<SaveResult<Workspace>> {
    let workspace = getWorkspaceInstance({
      ...item,
      ...{
        company_id: (context.user.server_request ? item.company_id : null) || context.company_id,
        name: "",
        dateAdded: Date.now(),
        isArchived: false,
        isDefault: false,
      },
    });

    if (item.id && !context?.user?.server_request) {
      // ON UPDATE
      workspace = await this.get({
        id: item.id,
        company_id: context.company_id,
      });

      if (!workspace) {
        throw new Error(`Unable to edit inexistent workspace ${item.id}`);
      }
    }

    const logoInternalPath = `/workspaces/${workspace.id}/thumbnail.png`;
    const logoPublicPath = `/internal/services/workspaces/v1/companies/${
      workspace.company_id
    }/workspaces/${workspace.id}/thumbnail?t=${new Date().getTime()}`;
    let logoPublicUrl = undefined;

    if (workspace.logo && item.logo === "none") {
      if (!options.logo_b64) {
        //If options.logo_b64 then we'll just replace the file content
        await gr.platformServices.storage.remove(logoInternalPath);
        workspace.logo = null;
      }
    }

    if (options.logo_b64) {
      const s = new Readable();
      s.push(Buffer.from(options.logo_b64.split(",").pop(), "base64"));
      s.push(null);
      await gr.platformServices.storage.write(logoInternalPath, s);
      logoPublicUrl = logoPublicPath;
    }

    workspace = merge(workspace, {
      name: await this.getWorkspaceName(item.name, context.company_id, workspace.id),
      isArchived: item.isArchived,
      isDefault: item.isDefault,
      logo: logoPublicUrl || workspace.logo,
    });

    await this.workspaceRepository.save(workspace, context);

    if (!item.id && context.user.id) {
      await this.addUser(
        { id: workspace.id, company_id: workspace.company_id },
        { id: context.user.id },
        "moderator",
      );
    }

    // On created
    if (!item.id) {
      gr.platformServices.messageQueue.publish("workspace:added", {
        data: {
          company_id: workspace.company_id,
          workspace_id: workspace.id,
        },
      });
    }

    return new SaveResult<Workspace>(
      TYPE,
      workspace,
      item.id ? OperationType.UPDATE : OperationType.CREATE,
    );
  }

  async thumbnail(workspaceId: string, context?: ExecutionContext): Promise<{ file: Readable }> {
    const logoInternalPath = `/workspaces/${workspaceId}/thumbnail.png`;
    const file = await gr.platformServices.storage.read(logoInternalPath, {}, context);
    return { file };
  }

  async delete(
    pk: WorkspacePrimaryKey,
    context?: ExecutionContext,
  ): Promise<DeleteResult<Workspace>> {
    const primaryKey: Workspace = merge(new Workspace(), pk);
    await this.workspaceRepository.remove(primaryKey, context);
    return new DeleteResult(TYPE, primaryKey, true);
  }

  // TODO: remove logic from context
  list<ListOptions>(
    pagination: Pagination,
    options?: ListOptions,
    context?: WorkspaceExecutionContext,
  ): Promise<ListResult<Workspace>> {
    const pk = { company_id: context.company_id };

    return this.workspaceRepository.find(pk, { pagination }, context);
  }

  async getAllForCompany(companyId: uuid, context?: ExecutionContext): Promise<Workspace[]> {
    let allCompanyWorkspaces: Workspace[] = [];
    let nextPage: Pagination = new Pagination("", "100");
    do {
      const tmp = await this.workspaceRepository.find(
        { company_id: companyId },
        { pagination: nextPage },
        context,
      );
      nextPage = tmp.nextPage as Pagination;
      allCompanyWorkspaces = [...allCompanyWorkspaces, ...tmp.getEntities()];
    } while (nextPage.page_token);

    //Check there is at least one workspace in this company or enforce one
    if (allCompanyWorkspaces.length == 0) {
      const created = await this.create(
        getWorkspaceInstance({
          company_id: companyId,
          name: "Home",
          isDefault: true,
        }),
      );
      allCompanyWorkspaces.push(created.entity);
    }

    return allCompanyWorkspaces;
  }

  async addUser(
    workspacePk: WorkspacePrimaryKey,
    userPk: UserPrimaryKey,
    role: WorkspaceUserRole,
    context?: ExecutionContext,
  ): Promise<void> {
    const wurPk = {
      workspaceId: workspacePk.id,
      userId: userPk.id,
    };

    const alreadyExists = await this.getUser(wurPk);
    if (!alreadyExists) {
      await this.userCounterIncrease(workspacePk.id, 1);
    }

    await this.workspaceUserRepository.save(
      getWorkspaceUserInstance({
        workspaceId: workspacePk.id,
        userId: userPk.id,
        role: role,
      }),
      context,
    );

    await gr.platformServices.messageQueue.publish(
      "workspace:member:added",
      {
        data: {
          company_id: workspacePk.company_id,
          workspace_id: workspacePk.id,
          user_id: userPk.id,
        },
      },
      context,
    );
  }

  async updateUserRole(
    workspaceUserPk: WorkspaceUserPrimaryKey,
    role: WorkspaceUserRole,
    context?: ExecutionContext,
  ): Promise<void> {
    const workspaceUser = await this.getUser(workspaceUserPk);
    if (!workspaceUser) {
      throw CrudException.notFound("WorkspaceUser entity not found");
    }
    await this.workspaceUserRepository.save(merge(workspaceUser, { role }), context);
  }

  async checkWorkspaceHasOtherAdmin(_workspaceUserPk: WorkspaceUserPrimaryKey): Promise<boolean> {
    //TODO: not implemented, we should check there is still an admin in the workspace before removal.
    // Note: company admin and owner are always workspace admins.
    return true;
  }

  async removeUser(
    workspaceUserPk: WorkspaceUserPrimaryKey,
    companyId: string,
    context?: ExecutionContext,
  ): Promise<DeleteResult<WorkspaceUserPrimaryKey>> {
    const entity = await this.getUser(workspaceUserPk);

    if (!entity) {
      throw CrudException.notFound("WorkspaceUser entity not found");
    }

    if (!(await this.checkWorkspaceHasOtherAdmin(workspaceUserPk))) {
      throw CrudException.notFound("No other admin found in workspace");
    }

    await this.workspaceUserRepository.remove(entity, context);
    await this.userCounterIncrease(workspaceUserPk.workspaceId, -1, context);

    localEventBus.publish<ResourceEventsPayload>(
      "workspace:user:deleted",
      {
        user: entity,
        workspace: { id: workspaceUserPk.workspaceId, company_id: companyId },
      },
      context,
    );

    return new DeleteResult(WorkspaceUserType, workspaceUserPk, true);
  }

  async getUsers(
    workspaceId: Pick<WorkspaceUserPrimaryKey, "workspaceId">,
    pagination?: Paginable,
    context?: ExecutionContext,
  ): Promise<ListResult<WorkspaceUser>> {
    const list = await this.workspaceUserRepository.find(
      { workspace_id: workspaceId.workspaceId },
      { pagination: { limitStr: pagination?.limitStr, page_token: pagination?.page_token } },
      context,
    );
    list.mapEntities(m => formatWorkspaceUser(m) as any);
    return list;
  }

  async getUser(
    workspaceUserPk: Pick<WorkspaceUserPrimaryKey, "workspaceId" | "userId">,
    context?: ExecutionContext,
  ): Promise<WorkspaceUser> {
    return formatWorkspaceUser(
      await this.workspaceUserRepository.findOne(
        {
          workspace_id: workspaceUserPk.workspaceId,
          user_id: workspaceUserPk.userId,
        },
        {},
        context,
      ),
    );
  }

  async processPendingUser(
    user: User,
    companyId?: string,
    _context?: ExecutionContext,
  ): Promise<void> {
    let userCompanies = [];
    if (!companyId) {
      userCompanies = await gr.services.companies.getAllForUser(user.id);
    } else {
      userCompanies = [
        await gr.services.companies.getCompanyUser({ id: companyId }, { id: user.id }),
      ];
    }
    for (const userCompany of userCompanies) {
      const workspaces = await this.getAllForCompany(userCompany.group_id);
      for (const workspace of workspaces) {
        const pendingUserPk = {
          workspace_id: workspace.id,
          email: user.email_canonical,
        };
        const pendingUser = await this.getPendingUser(pendingUserPk);

        if (pendingUser) {
          await this.removePendingUser(pendingUserPk);
          await this.addUser(
            { id: workspace.id, company_id: workspace.company_id },
            { id: user.id },
            pendingUser.role,
          );
        }
      }
    }
  }

  async getAllForUser(
    userId: Pick<WorkspaceUserPrimaryKey, "userId">,
    companyId: CompanyPrimaryKey,
    context?: ExecutionContext,
  ): Promise<WorkspaceUser[]> {
    //Process pending invitation to workspace for this user
    const user = await gr.services.users.get({ id: userId.userId });
    await this.processPendingUser(user, companyId?.id);

    //Get all workspaces for this user
    const allCompanyWorkspaces = await this.getAllForCompany(companyId.id, context);
    const userWorkspaces = (
      await Promise.all(
        allCompanyWorkspaces.map(workspace =>
          this.workspaceUserRepository.findOne(
            {
              user_id: userId.userId,
              workspace_id: workspace.id,
            },
            {},
            context,
          ),
        ),
      )
    )
      .map(m => formatWorkspaceUser(m))
      .filter(uw => uw);

    //If user is in no workspace, then it must be invited in the default workspaces, expect if he's guest
    if (userWorkspaces.length === 0) {
      for (const workspace of allCompanyWorkspaces) {
        if (workspace.isDefault && !workspace.isArchived && !workspace.isDeleted) {
          try {
            //Role will match the company role in the default workspaces
            const companyRole = await gr.services.companies.getCompanyUser(
              { id: companyId.id },
              { id: userId.userId },
              context,
            );
            let role: WorkspaceUserRole = "member";
            if (companyRole.role == "admin" || companyRole.role == "owner") role = "moderator";

            if (companyRole.role !== "guest") {
              await this.addUser(workspace, { id: userId.userId }, role, context);
              const uw = formatWorkspaceUser(
                await this.workspaceUserRepository.findOne(
                  {
                    user_id: userId.userId,
                    workspace_id: workspace.id,
                  },
                  {},
                  context,
                ),
              );
              if (uw) {
                userWorkspaces.push(uw);
              }
            }
          } catch (err) {
            logger.warn(err);
          }
        }
      }
    }

    return userWorkspaces;
  }

  getAllUsers$(
    workspaceId: Pick<WorkspaceUserPrimaryKey, "workspaceId">,
    pagination?: Paginable,
  ): Observable<WorkspaceUser> {
    return from(this.getUsers(workspaceId, pagination)).pipe(
      mergeMap(workspaceUsers => {
        const items$ = from(workspaceUsers.getEntities());
        const next$ = workspaceUsers?.nextPage?.page_token
          ? this.getAllUsers$(workspaceId, workspaceUsers.nextPage)
          : EMPTY;

        return concat(items$, next$);
      }),
    );
  }

  async addPendingUser(
    primaryKey: WorkspacePendingUserPrimaryKey,
    workspaceRole: WorkspaceUserRole,
    companyRole: CompanyUserRole,
    context?: ExecutionContext,
  ): Promise<void> {
    if (await this.getPendingUser(primaryKey)) {
      throw CrudException.badRequest("User is pending already");
    }
    const workspacePendingUser = merge(new WorkspacePendingUser(), {
      workspace_id: primaryKey.workspace_id,
      email: primaryKey.email,
      role: workspaceRole,
      company_role: companyRole,
    });
    await this.workspacePendingUserRepository.save(workspacePendingUser, context);
  }

  getPendingUser(
    primaryKey: WorkspacePendingUserPrimaryKey,
    context?: ExecutionContext,
  ): Promise<WorkspacePendingUser> {
    return this.workspacePendingUserRepository.findOne(primaryKey, {}, context);
  }

  async getPendingUsers(
    primaryKey: Pick<WorkspacePendingUserPrimaryKey, "workspace_id">,
    context?: ExecutionContext,
  ): Promise<WorkspacePendingUser[]> {
    return this.workspacePendingUserRepository
      .find(primaryKey, {}, context)
      .then(a => a.getEntities());
  }

  async removePendingUser(
    primaryKey: WorkspacePendingUserPrimaryKey,
    context?: ExecutionContext,
  ): Promise<DeleteResult<WorkspacePendingUserPrimaryKey>> {
    const pendingUser = await this.getPendingUser(primaryKey);
    if (!pendingUser) {
      throw CrudException.notFound("Pending user not found");
    }
    await this.workspacePendingUserRepository.remove(pendingUser, context);
    return new DeleteResult(WorkspacePendingUserType, primaryKey, true);
  }

  /**
   * @name GetWorkspaceName
   * @param exceptedName workspace name that user excepted to have
   * @param companyId company that user excepted to create or update the workspace
   * @param workspaceId
   * @param context
   * @returns if workspace name is already used in the company, this will return the exceptedName with the current duplicates number otherwise simply return the exceptedName
   */
  private async getWorkspaceName(exceptedName: string, companyId: string, workspaceId: string) {
    const workspacesList = await this.list(
      null,
      {},
      { company_id: companyId, user: { id: null, server_request: true } },
    );

    workspacesList.filterEntities(
      entity => entity.id !== workspaceId && _.includes(entity.name, exceptedName),
    );

    const shouldRenameWorkspace = !workspacesList.isEmpty();
    const duplicatesCount = workspacesList.getEntities().length;

    return shouldRenameWorkspace ? `${exceptedName}(${duplicatesCount + 1})` : exceptedName;
  }

  private wsCountPk = (id: string) => ({ id, counter_type: "members" });

  private userCounterIncrease(
    workspaceId: string,
    increaseValue: number,
    context?: ExecutionContext,
  ) {
    return this.workspaceCounter.increase(this.wsCountPk(workspaceId), increaseValue, context);
  }

  getUsersCount(workspaceId: string, context?: ExecutionContext): Promise<number> {
    return this.workspaceCounter.get(this.wsCountPk(workspaceId), context);
  }

  async getInviteToken(
    companyId: string,
    workspaceId: string,
    userId: string,
    context?: ExecutionContext,
  ): Promise<WorkspaceInviteTokenObject> {
    const pk = { company_id: companyId, workspace_id: workspaceId, user_id: userId };
    const res = await this.workspaceInviteTokensRepository.findOne(pk, {}, context);
    if (!res) return null;

    return {
      token: this.encodeInviteToken(companyId, workspaceId, userId, res.invite_token),
    };
  }

  async createInviteToken(
    companyId: string,
    workspaceId: string,
    userId: string,
    channels: string[],
    context?: ExecutionContext,
  ): Promise<WorkspaceInviteTokenObject> {
    await this.deleteInviteToken(companyId, workspaceId, userId);
    const token = randomBytes(32).toString("base64");
    const pk = { company_id: companyId, workspace_id: workspaceId, user_id: userId };
    await this.workspaceInviteTokensRepository.save(
      getWorkspaceInviteTokensInstance({ ...pk, invite_token: token, channels }),
      context,
    );
    return {
      token: this.encodeInviteToken(companyId, workspaceId, userId, token),
    };
  }

  async deleteInviteToken(
    companyId: string,
    workspaceId: string,
    userId: string,
    context?: ExecutionContext,
  ): Promise<boolean> {
    const pk = { company_id: companyId, workspace_id: workspaceId, user_id: userId };
    const currentRecord = await this.workspaceInviteTokensRepository.findOne(
      pk,
      undefined,
      context,
    );
    if (!currentRecord) {
      return false;
    }
    await this.workspaceInviteTokensRepository.remove(currentRecord, context);
    return true;
  }

  async getInviteTokenInfo(
    encodedToken: string,
    context?: ExecutionContext,
  ): Promise<WorkspaceInviteTokens> {
    let tokenInfo: InviteTokenObject;
    try {
      tokenInfo = this.decodeInviteToken(encodedToken);
    } catch (e) {}

    if (!tokenInfo) {
      return null;
    }

    const pk: WorkspaceInviteTokensPrimaryKey = {
      company_id: tokenInfo.c,
      workspace_id: tokenInfo.w,
      user_id: tokenInfo.u,
      invite_token: tokenInfo.t,
    };
    return this.workspaceInviteTokensRepository.findOne(pk, {}, context);
  }

  public encodeInviteToken(
    companyId: string,
    workspaceId: string,
    userId: string,
    token: string,
  ): string {
    // Change base64 characters to make them url safe
    token = token.replace(/\+/g, ".").replace(/\//g, "_").replace(/=/g, "-");
    const encodedToken = `${reduceUUID4(companyId)}-${reduceUUID4(workspaceId)}-${reduceUUID4(
      userId,
    )}-${token}`;
    return encodedToken;
  }

  public decodeInviteToken(encodedToken: string): InviteTokenObject | null {
    try {
      const split = encodedToken.split("-");
      //We split on "-" but the token can contain "-" so be careful
      // eslint-disable-next-line prefer-const
      let [companyId, workspaceId, userId, token] = [
        split.shift(),
        split.shift(),
        split.shift(),
        split.join("-"),
      ];
      if (!token) {
        return;
      }
      // Change back url safe characters to base64
      token = token.replace(/\./g, "+").replace(/_/g, "/").replace(/-/g, "=");
      return {
        c: expandUUID4(companyId),
        w: expandUUID4(workspaceId),
        u: expandUUID4(userId),
        t: token,
      };
    } catch (e) {
      return null;
    }
  }

  async ensureUserNotInCompanyIsNotInWorkspace(
    userPk: UserPrimaryKey,
    companyId: string,
    context?: ExecutionContext,
  ): Promise<void> {
    const workspaces = await this.getAllForCompany(companyId);
    for (const workspace of workspaces) {
      const companyUser = await gr.services.companies.getCompanyUser(
        { id: workspace.company_id },
        userPk,
        context,
      );
      if (!companyUser) {
        logger.warn(
          `User ${userPk.id} is not in company ${workspace.company_id} so removing from workspace ${workspace.id}`,
        );
        await this.removeUser(
          { workspaceId: workspace.id, userId: userPk.id },
          companyId,
          context,
        ).then(() => null);
      }
    }
  }

  /**
   * Sets the invitation domain for the specified workspace
   *
   * @param {{ company_id: string; workspace_id: string }} pk - the primary key
   * @param {String} domain - domain
   * @param {ExecutionContext} context - the execution context
   */
  setInviteDomain = async (
    pk: { company_id: string; workspace_id: string },
    domain: string,
    context?: ExecutionContext,
  ): Promise<void> => {
    const workspace = await gr.services.workspaces.get(
      {
        company_id: pk.company_id,
        id: pk.workspace_id,
      },
      context,
    );

    if (!workspace) {
      logger.error("failed to set invitation domain: workspace not found");
      throw CrudException.notFound("Workspace entity not found");
    }

    if (workspace.preferences && workspace.preferences?.invite_domain !== domain) {
      await this.workspaceInviteDomainRepository.remove({
        company_id: workspace.company_id,
        domain: workspace.preferences.invite_domain,
        workspace_id: workspace.id,
      });
    }

    if (workspace.preferences && workspace.preferences?.invite_domain === domain) {
      logger.warn("invite domain is already set");
      return;
    }

    workspace.preferences = {
      invite_domain: domain,
    };

    await this.workspaceRepository.save(workspace);

    const workspaceInvitationDomainEntry = await this.workspaceInviteDomainRepository.findOne(
      {
        ...pk,
        domain,
      },
      {},
      context,
    );

    if (!workspaceInvitationDomainEntry) {
      await this.workspaceInviteDomainRepository.save(
        getWorkspaceInviteDomainInstance({
          ...pk,
          domain,
        }),
      );
    }
  };

  /**
   * Get the workspaceinvitedomain entries for the specified domain
   *
   * @param {String} domain - the desired domain
   * @param {ExecutionContext} context - the execution context
   * @returns {Promise<WorkspaceInviteDomain[]>}
   */
  getInviteDomainWorkspaces = async (
    domain: string,
    context?: ExecutionContext,
  ): Promise<WorkspaceInviteDomain[]> => {
    const inviteDomainEntry = await this.workspaceInviteDomainRepository.find(
      { domain },
      {},
      context,
    );

    if (!inviteDomainEntry) {
      throw CrudException.notFound("workspace invite domain not found");
    }

    return inviteDomainEntry.getEntities();
  };
}
