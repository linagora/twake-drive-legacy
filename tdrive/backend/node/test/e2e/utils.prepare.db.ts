import { TestPlatform } from "./setup";
import User, { UserType } from "./../../src/services/user/entities/user";
import Company, {
  getInstance as getCompanyInstance,
} from "./../../src/services/user/entities/company";
import Workspace, {
  getInstance as getWorkspaceInstance,
  WorkspacePrimaryKey,
} from "./../../src/services/workspaces/entities/workspace";
import Session from "../../src/services/console/entities/session";

import { v1 as uuidv1 } from "uuid";
import CompanyUser from "../../src/services/user/entities/company_user";
import { DatabaseServiceAPI } from "../../src/core/platform/services/database/api";
import Repository from "../../src/core/platform/services/database/services/orm/repository/repository";
import Device from "../../src/services/user/entities/device";

import gr from "../../src/services/global-resolver";

export type uuid = string;

export class TestDbService {
  private deviceRepository: Repository<Device>;

  public static async getInstance(
    testPlatform: TestPlatform,
    createDefault = false,
  ): Promise<TestDbService> {
    const instance = new this(testPlatform);
    await instance.init();
    if (createDefault) {
      await instance.createDefault(testPlatform);
    }
    return instance;
  }

  public company: Company;
  public users: User[];
  private workspacesMap: Map<string, { workspace: Workspace; users: User[] }>;

  rand = () => Math.floor(Math.random() * 100000);
  private database: DatabaseServiceAPI;

  private companyUserRepository: Repository<CompanyUser>;
  private userRepository: Repository<User>;

  constructor(protected testPlatform: TestPlatform) {
    this.database = this.testPlatform.platform.getProvider<DatabaseServiceAPI>("database");
    this.users = [];
    this.workspacesMap = new Map<string, { workspace: Workspace; users: User[] }>();
    this.workspacesMap.set("direct", {
      workspace: { id: "direct" } as Workspace,
      users: [],
    });
  }

  private async init() {
    this.userRepository = await this.database.getRepository<User>("user", User);
    this.companyUserRepository = await this.database.getRepository<CompanyUser>(
      "group_user",
      CompanyUser,
    );
    this.deviceRepository = await this.database.getRepository<Device>("device", Device);
  }

  public get workspaces() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return [...this.workspacesMap.values()].filter(w => w.workspace.id !== "direct");
  }

  async createCompany(id?: uuid, name?: string): Promise<Company> {
    if (!name) {
      name = `TdriveAutotests-test-company-${this.rand()}`;
    }
    this.company = await gr.services.companies.createCompany(
      getCompanyInstance({
        id: id || uuidv1(),
        name: name,
        displayName: name,
        identity_provider_id: id,
      }),
    );
    return this.company;
  }

  async createWorkspace(
    workspacePk: WorkspacePrimaryKey,
    name = `TdriveAutotests-test-workspace-${this.rand()}`,
  ): Promise<Workspace> {
    if (!workspacePk.company_id) throw new Error("company_id is not defined for workspace");

    const workspace = await gr.services.workspaces.create(
      getWorkspaceInstance({
        id: workspacePk.id,
        name: name,
        logo: "workspace_logo",
        company_id: workspacePk.company_id,
      }),
      { user: { id: "", server_request: true } },
    );

    const createdWorkspace = await gr.services.workspaces.get({
      id: workspacePk.id,
      company_id: workspacePk.company_id,
    });

    if (!createdWorkspace) {
      throw new Error("workspace wasn't created");
    }

    const createdWorkspaceEntity = workspace.entity;
    this.workspacesMap.set(createdWorkspaceEntity.id, {
      workspace: createdWorkspaceEntity,
      users: [],
    });
    return createdWorkspaceEntity;
  }

  async createUser(
    workspacesPk?: Array<WorkspacePrimaryKey>,
    options: {
      companyRole?: "member" | "admin" | "guest";
      workspaceRole?: "member" | "moderator";
      firstName?: string;
      lastName?: string;
      email?: string;
      username?: string;
      password?: string;
      cache?: User["cache"];
      identity_provider?: string;
      type?: UserType;
    } = {},
    id: string = uuidv1(),
  ): Promise<User> {
    const user = new User();
    const random = this.rand();
    user.id = id;
    user.username_canonical = options.username || `test${random}`;
    user.first_name = options.firstName || `test${random}_first_name`;
    user.last_name = options.lastName || `test${random}_last_name`;
    user.email_canonical = options.email || `test${random}@tdrive.app`;
    user.identity_provider_id = user.id;
    user.cache = options.cache || user.cache || { companies: [] };
    user.identity_provider = options.identity_provider || "console";
    user.type = options.type || "regular";

    //Fixme this is cheating, we should correctly set the cache in internal mode in the code
    user.cache.companies = [
      ...(user.cache.companies || []),
      ...workspacesPk.map(w => w.company_id),
    ];
    if (options.email) {
      user.email_canonical = options.email;
    }
    const createdUser = (await gr.services.users.create(user)).entity;

    if (options.password) {
      await gr.services.users.setPassword({ id: createdUser.id }, options.password);
    }

    this.users.push(createdUser);
    if (workspacesPk && workspacesPk.length) {
      await gr.services.companies.setUserRole(
        this.company ? this.company.id : workspacesPk[0].company_id,
        createdUser.id,
        options.companyRole ? options.companyRole : "member",
      );
    }

    if (workspacesPk && workspacesPk.length) {
      for (const workspacePk of workspacesPk) {
        await gr.services.workspaces.addUser(
          workspacePk,
          { id: createdUser.id },
          options.workspaceRole ? options.workspaceRole : "member",
        );
        const wsContainer = this.workspacesMap.get(workspacePk.id);
        wsContainer.users.push(createdUser);
      }
    }

    return createdUser;
  }

  async getUserFromDb(user: Partial<Pick<User, "id" | "identity_provider_id">>): Promise<User> {
    if (user.id) {
      return gr.services.users.get({ id: user.id });
    } else if (user.identity_provider_id) {
      return gr.services.users.getByConsoleId(user.identity_provider_id);
    } else {
      throw new Error("getUserFromDb: Id not provided");
    }
  }

  async getDeviceFromDb(id: string): Promise<Device> {
    return this.deviceRepository.findOne({ id });
  }

  getCompanyFromDb(companyId: uuid) {
    return gr.services.companies.getCompany({ id: companyId });
  }

  getCompanyFromDbByCode(code: uuid) {
    return gr.services.companies.getCompany({ identity_provider_id: code });
  }

  async getCompanyUsers(companyId: uuid): Promise<User[]> {
    const allUsers = await this.userRepository.find({}).then(a => a.getEntities());

    const companyUsers: User[] = [];

    for (const user of allUsers) {
      const userInCompany = await this.companyUserRepository.findOne({
        user_id: user.id,
        group_id: companyId,
      });
      if (userInCompany) {
        companyUsers.push(user);
      }
    }
    return companyUsers;
  }

  getCompanyUser(companyId: uuid, userId: uuid): Promise<CompanyUser> {
    return gr.services.companies.getCompanyUser({ id: companyId }, { id: userId });
  }

  getWorkspaceUsersCountFromDb(workspaceId: string) {
    return gr.services.workspaces.getUsersCount(workspaceId);
  }

  async getCompanyUsersCountFromDb(companyId: string) {
    return gr.services.companies.getUsersCount(companyId);
  }

  async createDefault(
    platform: TestPlatform = this.testPlatform,
    isAdmin: boolean = true,
  ): Promise<TestDbService> {
    await this.createCompany(platform.workspace.company_id);
    const ws0pk = {
      id: platform.workspace.workspace_id,
      company_id: platform.workspace.company_id,
    };
    await this.createWorkspace(ws0pk);
    await this.createUser(
      [ws0pk],
      {
        firstName: "defaultUser",
        companyRole: isAdmin ? "admin" : "member",
        workspaceRole: isAdmin ? "moderator" : "member",
      },
      platform.currentUser.id,
    );
    return this;
  }

  async createSession(sid: string, sub: string): Promise<Session> {
    const session = new Session();
    session.sid = sid;
    session.sub = sub;
    const sessionRepository = await this.database.getRepository<Session>("session", Session);
    await sessionRepository.save(session);
    return session;
  }

  async getSessionById(sid: string): Promise<Session> {
    const sessionRepository = await this.database.getRepository<Session>("session", Session);
    return sessionRepository.findOne({ sid });
  }

  async getSessionsByUserId(sub: string): Promise<Session[]> {
    const sessionRepository = await this.database.getRepository<Session>("session", Session);
    return (await sessionRepository.find({ sub })).getEntities();
  }

  async cleanUp() {
    await this.database.getConnector().drop();
  }

  getRepository = (type, entity) => {
    return this.database.getRepository<typeof entity>(type, entity);
  };

  defaultWorkspace() {
    return this.workspaces[0].workspace;
  }
}
