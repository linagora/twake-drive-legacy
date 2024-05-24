import { DatabaseServiceAPI } from "../../core/platform/services/database/api";
import { ConsoleOptions, ConsoleType } from "./types";
import { ConsoleServiceClient } from "./client-interface";
import { ConsoleClientFactory } from "./client-factory";
import User from "../user/entities/user";
import gr from "../global-resolver";
import { Configuration, TdriveServiceProvider } from "../../core/platform/framework";
import assert from "assert";
import { ExecutionContext } from "../../core/platform/framework/api/crud-service";
import Repository from "src/core/platform/services/database/services/orm/repository/repository";
import Session from "./entities/session";

export class ConsoleServiceImpl implements TdriveServiceProvider {
  version: "1";

  consoleType: ConsoleType;
  consoleOptions: ConsoleOptions;
  services: {
    database: DatabaseServiceAPI;
  };
  private configuration: Configuration;
  private sessionRepository: Repository<Session>;

  constructor(options?: ConsoleOptions) {
    this.consoleOptions = options;
  }

  async init(): Promise<this> {
    this.configuration = new Configuration("general.accounts");
    assert(this.configuration, "console configuration is missing");
    const type = this.configuration.get("type") as ConsoleType;
    assert(type, "console configuration type is not defined");

    const s = this.configuration.get(type) as ConsoleOptions;

    this.consoleOptions = {
      type: type,
      authority: s.authority,
      client_id: s.client_id,
      client_secret: s.client_secret,
      audience: s.audience,
      issuer: s.issuer,
      jwks_uri: s.jwks_uri,
      redirect_uris: s.redirect_uris,
      disable_account_creation: s.disable_account_creation,
    };

    this.consoleOptions.type = type;
    this.consoleType = type;
    this.sessionRepository =
      type === "remote" ? await gr.database.getRepository<Session>("session", Session) : null;

    return this;
  }

  getClient(): ConsoleServiceClient {
    return ConsoleClientFactory.create(this);
  }

  getSessionRepo(): Repository<Session> {
    return this.sessionRepository;
  }

  async processPendingUser(user: User, context?: ExecutionContext): Promise<void> {
    await gr.services.workspaces.processPendingUser(user, null, context);
  }
}
