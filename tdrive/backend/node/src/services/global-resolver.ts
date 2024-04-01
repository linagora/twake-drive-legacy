import { FastifyInstance } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";

import { TdrivePlatform } from "../core/platform/platform";
import AuthServiceAPI from "../core/platform/services/auth/provider";
import { CounterAPI } from "../core/platform/services/counter/types";
import { CronAPI } from "../core/platform/services/cron/api";
import { DatabaseServiceAPI } from "../core/platform/services/database/api";
import EmailPusherAPI from "../core/platform/services/email-pusher/provider";
import { MessageQueueServiceAPI } from "../core/platform/services/message-queue/api";
import { PushServiceAPI } from "../core/platform/services/push/api";
import { RealtimeServiceAPI } from "../core/platform/services/realtime/api";
import { SearchServiceAPI } from "../core/platform/services/search/api";
import StorageAPI from "../core/platform/services/storage/provider";
import TrackerAPI from "../core/platform/services/tracker/provider";
import WebServerAPI from "../core/platform/services/webserver/provider";
import WebSocketAPI from "../core/platform/services/websocket/provider";

import assert from "assert";
import { logger } from "../core/platform/framework";
import { ApplicationServiceImpl } from "./applications/services/applications";
import { CompanyApplicationServiceImpl } from "./applications/services/company-applications";
import { ApplicationHooksService } from "./applications/services/hooks";
import { ConsoleServiceImpl } from "./console/service";
import { DocumentsService } from "./documents/services";
import { DocumentsEngine } from "./documents/services/engine";
import { FileServiceImpl } from "./files/services";
import { PreviewProcessService } from "./previews/services/files/processing/service";
import { StatisticsServiceImpl } from "./statistics/service";
import { TagsService } from "./tags/services/tags";
import { CompanyServiceImpl } from "./user/services/companies";
import { UserExternalLinksServiceImpl } from "./user/services/external_links";
import { UserServiceImpl } from "./user/services/users/service";
import { WorkspaceServiceImpl } from "./workspaces/services/workspace";

import { PreviewEngine } from "./previews/services/files/engine";
import { I18nService } from "./i18n";

type PlatformServices = {
  auth: AuthServiceAPI;
  counter: CounterAPI;
  cron: CronAPI;
  messageQueue: MessageQueueServiceAPI;
  push: PushServiceAPI;
  realtime: RealtimeServiceAPI;
  search: SearchServiceAPI;
  storage: StorageAPI;
  tracker: TrackerAPI;
  webserver: WebServerAPI;
  websocket: WebSocketAPI;
  emailPusher: EmailPusherAPI;
};

type TdriveServices = {
  workspaces: WorkspaceServiceImpl;
  companies: CompanyServiceImpl;
  users: UserServiceImpl;
  console: ConsoleServiceImpl;
  statistics: StatisticsServiceImpl;
  externalUser: UserExternalLinksServiceImpl;
  preview: {
    files: PreviewProcessService;
  };
  applications: {
    marketplaceApps: ApplicationServiceImpl;
    companyApps: CompanyApplicationServiceImpl;
    hooks: ApplicationHooksService;
  };
  files: FileServiceImpl;
  documents: {
    documents: DocumentsService;
    engine: DocumentsEngine;
  };
  tags: TagsService;
  i18n: I18nService;
};

class GlobalResolver {
  public services: TdriveServices;
  public platformServices: PlatformServices;
  public database: DatabaseServiceAPI;

  public fastify: FastifyInstance<Server, IncomingMessage, ServerResponse>;

  private alreadyInitialized = false;

  async doInit(platform: TdrivePlatform) {
    if (this.alreadyInitialized) {
      return;
    }
    this.database = platform.getProvider<DatabaseServiceAPI>("database");

    this.platformServices = {
      auth: platform.getProvider<AuthServiceAPI>("auth"),
      counter: platform.getProvider<CounterAPI>("counter"),
      cron: platform.getProvider<CronAPI>("cron"),
      messageQueue: platform.getProvider<MessageQueueServiceAPI>("message-queue"),
      push: platform.getProvider<PushServiceAPI>("push"),
      realtime: platform.getProvider<RealtimeServiceAPI>("realtime"),
      search: platform.getProvider<SearchServiceAPI>("search"),
      storage: platform.getProvider<StorageAPI>("storage"),
      tracker: platform.getProvider<TrackerAPI>("tracker"),
      webserver: platform.getProvider<WebServerAPI>("webserver"),
      websocket: platform.getProvider<WebSocketAPI>("websocket"),
      emailPusher: platform.getProvider<EmailPusherAPI>("email-pusher"),
    };

    this.fastify = this.platformServices.webserver.getServer();

    Object.keys(this.platformServices).forEach((key: keyof PlatformServices) => {
      const service = this.platformServices[key];
      assert(service, `Platform service ${key} was not initialized`);
    });

    await new PreviewEngine().init();

    this.services = {
      workspaces: await new WorkspaceServiceImpl().init(),
      companies: await new CompanyServiceImpl().init(),
      users: await new UserServiceImpl().init(),
      console: await new ConsoleServiceImpl().init(),
      statistics: await new StatisticsServiceImpl().init(),
      externalUser: await new UserExternalLinksServiceImpl().init(),
      preview: {
        files: await new PreviewProcessService().init(),
      },
      applications: {
        marketplaceApps: await new ApplicationServiceImpl().init(),
        companyApps: await new CompanyApplicationServiceImpl().init(),
        hooks: await new ApplicationHooksService().init(),
      },
      files: await new FileServiceImpl().init(),
      documents: {
        documents: await new DocumentsService().init(),
        engine: await new DocumentsEngine().init(),
      },
      tags: await new TagsService().init(),
      i18n: await new I18nService().init(),
    };

    Object.keys(this.services).forEach((key: keyof TdriveServices) => {
      assert(this.services[key], `Service ${key} was not initialized`);
      if (this.services[key].constructor.name == "Object") {
        const subs = this.services[key] as any;
        Object.keys(subs).forEach(sk => {
          assert(subs[sk], `Service ${key}.${sk} was not initialized`);
        });
      }
    });

    logger.info("Global resolver finished initializing services");
    this.alreadyInitialized = true;
  }
}

export default new GlobalResolver();
