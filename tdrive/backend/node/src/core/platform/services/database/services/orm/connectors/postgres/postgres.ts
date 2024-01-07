import { AbstractConnector } from "../abstract-connector";
import { ColumnDefinition, EntityDefinition } from "../../types";
import { ListResult } from "src/core/platform/framework/api/crud-service";
import { FindOptions } from "../../repository/repository";
import { Client, QueryResult } from "pg";
import { getLogger } from "../../../../../../framework";

export interface PostgresConnectionOptions {
  database: string;
  user: string;
  password: string;
  port: number;
  host: string;
  ssl: false;
  idleTimeoutMillis: 1000; // close idle clients after 1 second
  connectionTimeoutMillis: 1000; // return an error after 1 second if connection could not be established
  statement_timeout: number; // number of milliseconds before a statement in query will time out, default is no timeout
  query_timeout: number; // number of milliseconds before a query call will timeout, default is no timeout
}

export class PostgresConnector extends AbstractConnector<PostgresConnectionOptions> {
  logger = getLogger("PostgresConnector");

  client: Client = new Client(this.options);

  private async healthcheck(): Promise<void> {
    const result: QueryResult = await this.client.query("SELECT NOW()");
    if (!result || result.rowCount != 1) {
      throw new Error("Connection Error");
    }
    this.logger.info(`DB connection is fine, current time is ${result.rows[0].now}`);
  }

  async connect(): Promise<this> {
    if (this.client) {
      this.logger.info("Connecting to DB");
      this.client.on("error", err => {
        this.logger.warn(err, "PostgreSQL connection error");
      });

      await this.client.connect();
      this.logger.info("Connection pool created");
      await this.healthcheck();
    }
    return this;
  }

  async init(): Promise<this> {
    if (!this.client) {
      await this.connect();
    }
    return this;
  }

  async createTable(
    entity: EntityDefinition,
    columns: { [p: string]: ColumnDefinition },
  ): Promise<boolean> {
    const columnsString = Object.keys(columns)
      .map(colName => {
        const definition = columns[colName];
        return `${colName} ${typeMappings[definition.type]}`;
      })
      .join(",\n");

    // --- Generate final create table query --- //
    const query = `
        CREATE TABLE IF NOT EXISTS ${entity.name}
          (
            ${columnsString}
          );`;

    try {
      this.logger.debug(
        `service.database.orm.createTable - Creating table ${entity.name} : ${query}`,
      );
      const result: QueryResult = await this.client.query(query);
      this.logger.info(`Table is created with the result ${result}`);
    } catch (err) {
      this.logger.warn(
        { err },
        `service.database.orm.createTable - creation error for table ${entity.name} : ${err.message}`,
      );
      return false;
    }

    //--- Alter table if not up to date --- //
    await this.alterTable(entity, columns);

    // --- Create primary key --- //
    await this.alterTablePrimaryKey(entity);

    // --- Create indexes --- //
    return await this.alterTableIndexes(entity);
  }

  private async alterTableIndexes(entity: EntityDefinition) {
    if (entity.options.globalIndexes) {
      for (const globalIndex of entity.options.globalIndexes) {
        const indexName = globalIndex.join("_");
        const indexDbName = `index_${entity.name}_${indexName}`;

        const query = `CREATE INDEX IF NOT EXISTS ${indexDbName} ON ${entity.name} 
        (${globalIndex.length === 1 ? globalIndex[0] : `(${globalIndex[0]}), ${globalIndex[1]}`})`;

        try {
          this.logger.debug(`Creating index ${indexName} (${indexDbName}) : ${query}`);
          await this.client.query(query);
        } catch (err) {
          this.logger.warn(
            err,
            `Creation error for index ${indexName} (${indexDbName}) : ${err.message}`,
          );
          return false;
        }
      }
    }
  }

  private async alterTablePrimaryKey(entity: EntityDefinition) {
    if (entity.options.primaryKey) {
      const query = `ALTER TABLE ${entity.name} ADD PRIMARY KEY (
        ${entity.options.primaryKey.join(", ")});`;
      try {
        await this.client.query(query);
      } catch (err) {
        this.logger.warn(err, `Error creating primary key for ${entity.name}`);
      }
    }
  }

  private async alterTable(entity: EntityDefinition, columns: { [p: string]: ColumnDefinition }) {
    const existingColumns = await this.getTableDefinition(entity.name);
    if (existingColumns.length > 0) {
      this.logger.debug(`Existing columns for table ${entity.name}, generating altertable queries`);
      const alterQueryColumns = Object.keys(columns)
        .filter(colName => existingColumns.indexOf(colName) < 0)
        .map(colName => `ADD COLUMN ${colName} ${typeMappings[columns[colName].type]}`)
        .join(", ");

      if (alterQueryColumns.length > 0) {
        const alterQuery = `ALTER TABLE ${entity.name} ${alterQueryColumns}`;
        const queryResult: QueryResult = await this.client.query(alterQuery);
        this.logger.info(`Table is altered with the result ${queryResult}`);
      }
    }
  }

  drop(): Promise<this> {
    return Promise.resolve(undefined);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  find<EntityType>(
    entityType: any,
    filters: any,
    options: FindOptions,
  ): Promise<ListResult<EntityType>> {
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

  async getTableDefinition(name: string): Promise<string[]> {
    try {
      const query = `SELECT 
           table_name, 
           column_name, 
           data_type 
        FROM 
           information_schema.columns
        WHERE 
           table_name = $1`;
      const dbResult: QueryResult<TableRowInfo> = await this.client.query(query, [name]);
      return dbResult.rows.map(row => row.column_name);
    } catch (err) {
      this.logger.warn("Error querying table information", err);
      throw err;
    }
  }
}

const typeMappings = {
  encoded_string: "TEXT",
  encoded_json: "TEXT",
  string: "TEXT",
  number: "BIGINT",
  timeuuid: "UUID",
  uuid: "UUID",
  counter: "BIGINT",
  blob: "BLOB",
  boolean: "BOOLEAN",

  // backward compatibility
  tdrive_boolean: "BOOLEAN",
  tdrive_datetime: "BIGINT", //Deprecated
};

export type TableRowInfo = {
  table_name: string;
  column_name: string;
  data_type: string;
};
