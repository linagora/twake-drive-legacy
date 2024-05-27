import { DatabaseServiceAPI } from "../api";
import { ConnectorFactory } from "./connector-factory";
import { Connector } from "./orm/connectors";
import Manager from "./orm/manager";
import Repository from "./orm/repository/repository";
import { MongoConnectionOptions } from "./orm/connectors/mongodb/mongodb";
import { EntityTarget } from "./orm/types";
import { RepositoryManager } from "./orm/repository/manager";
import { PostgresConnectionOptions } from "./orm/connectors/postgres/postgres";

export default class DatabaseService implements DatabaseServiceAPI {
  version = "1";
  private connector: Connector;
  private entityManager: RepositoryManager;

  constructor(
    readonly type: DatabaseType,
    private options: ConnectionOptions,
    readonly secret: string,
  ) {
    this.entityManager = new RepositoryManager(this);
  }

  getConnector(): Connector {
    if (this.connector) {
      return this.connector;
    }

    this.connector = new ConnectorFactory().create(this.type, this.options, this.secret);

    return this.connector;
  }

  async disconnect() {
    if (this.connector) {
      await this.connector.disconnect();
      this.connector = null;
    }
  }

  getManager(): Manager<unknown> {
    return new Manager<unknown>(this.connector);
  }

  getRepository<Entity>(table: string, entity: EntityTarget<Entity>): Promise<Repository<Entity>> {
    return this.entityManager.getRepository(table, entity);
  }
}

export declare type ConnectionOptions = MongoConnectionOptions | PostgresConnectionOptions;

export declare type DatabaseType = "mongodb" | "postgres";
