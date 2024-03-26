import { TdriveService, logger, ServiceName } from "../../framework";
import { DatabaseServiceAPI } from "./api";
import DatabaseService from "./services";
import { DatabaseType } from "./services";
import { ConnectionOptions } from "./services/orm/connectors";

@ServiceName("database")
export default class Database extends TdriveService<DatabaseServiceAPI> {
  version = "1";
  name = "database";
  service: DatabaseService;

  public async doInit(): Promise<this> {
    const driver = this.configuration.get<DatabaseType>("type");
    const secret = this.configuration.get<string>("secret");

    if (!driver) {
      throw new Error("Database driver name must be specified in 'database.type' configuration");
    }

    const configuration: ConnectionOptions = this.configuration.get<ConnectionOptions>(driver);

    this.service = new DatabaseService(driver, configuration, secret);
    const dbConnector = this.service.getConnector();

    try {
      logger.info("Connecting to database %o", configuration);
      await dbConnector.connect();
      await dbConnector.init();
      logger.info("Connected to database");
    } catch (err) {
      logger.error("Failed to connect to database", err);
      throw new Error("Failed to connect to db");
    }

    return this;
  }

  public async doStop(): Promise<this> {
    if (this.service) {
      await this.service.disconnect();
      this.service = null;
    }
    return this;
  }

  api(): DatabaseServiceAPI {
    return this.service;
  }
}
