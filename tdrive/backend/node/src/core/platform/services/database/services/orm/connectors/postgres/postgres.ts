import { AbstractConnector } from "../abstract-connector";
import { ColumnDefinition, EntityDefinition } from "../../types";
import { ListResult } from "src/core/platform/framework/api/crud-service";
import { FindOptions } from "../../repository/repository";
import Pool from "pg-pool";
import { Client } from "pg";
import { logger } from "../../../../../../framework";

export interface PostgresConnectionOptions {
  database: string;
  user: string;
  password: string;
  port: number;
  ssl: false;
  max: 10;
  idleTimeoutMillis: 1000; // close idle clients after 1 second
  connectionTimeoutMillis: 1000; // return an error after 1 second if connection could not be established
}

export class PostgresConnector extends AbstractConnector<PostgresConnectionOptions> {
  private pool: Pool<Client>;

  async connect(): Promise<this> {
    if (!this.pool) {
      logger.info("Creting connection pool");
      this.pool = new Pool<Client>(this.options);
      logger.info("Connection pool created");
    }
    return this;
  }

  async init(): Promise<this> {
    if (!this.pool) {
      await this.connect();
    }
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createTable(
    entity: EntityDefinition,
    columns: { [p: string]: ColumnDefinition },
  ): Promise<boolean> {
    return Promise.resolve(false);
  }

  drop(): Promise<this> {
    return Promise.resolve(undefined);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  find<EntityType>(entityType: any, filters: any, options: FindOptions): Promise<ListResult<EntityType>> {
    return Promise.resolve(undefined);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  remove(entities: any[]): Promise<boolean[]> {
    return Promise.resolve([]);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  upsert(entities: any[]): Promise<boolean[]> {
    return Promise.resolve([]);
  }
}
