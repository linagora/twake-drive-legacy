import { resolve as pathResolve } from "path";
import { v1 as uuidv1 } from "uuid";
import { FastifyInstance } from "fastify";
import { TdrivePlatform, TdrivePlatformConfiguration } from "../../../src/core/platform/platform";
import WebServerAPI from "../../../src/core/platform/services/webserver/provider";
import { DatabaseServiceAPI } from "../../../src/core/platform/services/database/api";
import AuthServiceAPI from "../../../src/core/platform/services/auth/provider";
import { Workspace } from "../../../src/utils/types";
import { MessageQueueServiceAPI } from "../../../src/core/platform/services/message-queue/api";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import config from "config";
import globalResolver from "../../../src/services/global-resolver";
import {FileServiceImpl} from "../../../src/services/files/services";
import StorageAPI from "../../../src/core/platform/services/storage/provider";
import {SearchServiceAPI} from "../../../src/core/platform/services/search/api";
import Session from "../../../src/services/console/entities/session";

type TokenPayload = {
  sub: string;
  sid?: string;
  org?: {
    [companyId: string]: {
      role: string;
    };
  };
};

export type User = {
  id: string;
  first_name?: string;
  isWorkspaceModerator?: boolean;
};

export interface TestPlatform {
  currentUser: User;
  currentSession: string;
  platform: TdrivePlatform;
  workspace: Workspace;
  app: FastifyInstance;
  database: DatabaseServiceAPI;
  storage: StorageAPI;
  messageQueue: MessageQueueServiceAPI;
  authService: AuthServiceAPI;
  filesService: FileServiceImpl;
  auth: {
    getJWTToken(payload?: TokenPayload): Promise<string>;
  };
  tearDown(): Promise<void>;
  search: SearchServiceAPI;
}

export interface TestPlatformConfiguration {
  services: string[];
}

let testPlatform: TestPlatform = null;

export async function init(
  testConfig?: TestPlatformConfiguration,
  prePlatformStartCallback?: (fastify: FastifyInstance) => void,
): Promise<TestPlatform> {
  if (!testPlatform) {
    const configuration: TdrivePlatformConfiguration = {
      services: config.get("services"),
      servicesPath: pathResolve(__dirname, "../../../src/services/"),
    };
    const platform = new TdrivePlatform(configuration);
    await platform.init();
    await globalResolver.doInit(platform);

    const app = platform.getProvider<WebServerAPI>("webserver").getServer();

    if (prePlatformStartCallback) {
      prePlatformStartCallback(app);
    }

    await platform.start();

    const database = platform.getProvider<DatabaseServiceAPI>("database");
    await database.getConnector().drop();
    const messageQueue = platform.getProvider<MessageQueueServiceAPI>("message-queue");
    const auth = platform.getProvider<AuthServiceAPI>("auth");
    const storage: StorageAPI = platform.getProvider<StorageAPI>("storage");
    const search: SearchServiceAPI = platform.getProvider<SearchServiceAPI>("search");

    testPlatform = {
      platform,
      app,
      messageQueue,
      database,
      storage,
      workspace: { company_id: "", workspace_id: "" },
      currentUser: { id: "" },
      currentSession: uuidv1(),
      authService: auth,
      filesService: globalResolver.services.files,
      auth: {
        getJWTToken,
      },
      tearDown,
      search,
    };
  }

  testPlatform.app.server.close();

  testPlatform.currentUser = { id: uuidv1() };
  testPlatform.workspace = {
    company_id: uuidv1(),
    workspace_id: uuidv1(),
  };

  testPlatform.app.server.listen(3000);
  //await testPlatform.messageQueue.start();

  async function getJWTToken(
    payload: TokenPayload = { sub: testPlatform.currentUser.id, sid: testPlatform.currentSession },
  ): Promise<string> {
    const sessionRepository = await testPlatform.database.getRepository<Session>("session", Session);
    if (!payload.sub) {
      payload.sub = testPlatform.currentUser.id;
    }
    if (!payload.sid) {
      payload.sid = testPlatform.currentSession;
    }

    let session = (await sessionRepository.find({ sub: payload.sub })).getEntities();
    if (session.length == 0) {
      const session = new Session();
      session.sid = payload.sid;
      session.sub = payload.sub;
      await sessionRepository.save(session);
    }

    if (testPlatform.currentUser.isWorkspaceModerator) {
      payload.org = {};
      payload.org[testPlatform.workspace.company_id] = {
        role: "",
      };
    }

    return testPlatform.authService.sign(payload);
  }

  async function tearDown(): Promise<void> {
    if (testPlatform) {
      testPlatform.app.server.close();
      //await testPlatform.messageQueue.stop();
    }
  }

  return testPlatform;
}
