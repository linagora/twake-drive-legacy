import { AbstractConnector } from "../abstract-connector";
import { ColumnDefinition, EntityDefinition, ObjectType } from "../../types";
import { ListResult, Paginable, Pagination } from "../../../../../../framework/api/crud-service";
import { FindOptions } from "../../repository/repository";
import { Client, QueryResult } from "pg";
import { getLogger, logger } from "../../../../../../framework";
import { getEntityDefinition } from "../../../orm/utils";
import { UpsertOptions } from "src/core/platform/services/database/services/orm/connectors";
import { PostgresDataTransformer, TypeMappings } from "./postgres-data-transform";
import { PostgresQueryBuilder, Query } from "./postgres-query-builder";

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
  query_timeout: number; // number of milliseconds before a query call will time out, default is no timeout
}

export class PostgresConnector extends AbstractConnector<PostgresConnectionOptions> {
  private logger = getLogger("PostgresConnector");
  private client: Client = new Client(this.options);
  private dataTransformer = new PostgresDataTransformer({ secret: this.secret });
  private queryBuilder = new PostgresQueryBuilder(this.secret);

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
        return `${colName} ${TypeMappings[definition.type]}`;
      })
      .join(",\n");

    // --- Generate final create table query --- //
    const query = `
        CREATE TABLE IF NOT EXISTS "${entity.name}"
          (
            ${columnsString}
          );`;

    try {
      this.logger.debug(
        `service.database.orm.createTable - Creating table ${entity.name} : ${query}`,
      );
      const result: QueryResult = await this.client.query(query);
      this.logger.info(`Table is created with the result ${JSON.stringify(result)}`);
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

        const query = `CREATE INDEX IF NOT EXISTS ${indexDbName} ON "${entity.name}" 
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
      const query = `
        do $$
        begin
        IF NOT EXISTS 
          (SELECT constraint_name 
          FROM information_schema.table_constraints 
          WHERE table_name = '${entity.name}' 
          and constraint_type = 'PRIMARY KEY') 
        THEN
          ALTER TABLE "${entity.name}" ADD PRIMARY KEY (
          ${entity.options.primaryKey.join(", ")});
        END IF;
        end $$;`;
      try {
        await this.client.query(query);
      } catch (err) {
        this.logger.warn(err, `Error creating primary key for "${entity.name}"`);
      }
    }
  }

  private async alterTable(entity: EntityDefinition, columns: { [p: string]: ColumnDefinition }) {
    const existingColumns = await this.getTableDefinition(entity.name);
    if (existingColumns.length > 0) {
      this.logger.debug(
        `Existing columns for table "${entity.name}", generating alter table queries ...`,
      );
      const alterQueryColumns = Object.keys(columns)
        .filter(colName => existingColumns.indexOf(colName) < 0)
        .map(colName => `ADD COLUMN ${colName} ${TypeMappings[columns[colName].type]}`)
        .join(", ");

      if (alterQueryColumns.length > 0) {
        const alterQuery = `ALTER TABLE "${entity.name}" ${alterQueryColumns}`;
        const queryResult: QueryResult = await this.client.query(alterQuery);
        this.logger.info(`Table is altered with the result ${queryResult}`);
      }
    }
  }

  async drop(): Promise<this> {
    logger.info("Drop database is not implemented for security reasons.");
    return this;
  }

  async dropTables(): Promise<this> {
    const query = `
        DO $$ 
        DECLARE 
          tablename text;
        BEGIN 
          FOR tablename IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public') 
          LOOP 
            EXECUTE 'DROP TABLE IF EXISTS "' || tablename || '" CASCADE'; 
          END LOOP; 
        END $$;`;
    logger.debug(`service.database.orm.postgres.dropTables - Query: "${query}"`);
    await this.client.query(query);
    return this;
  }

  async find<EntityType>(
    entityType: ObjectType<EntityType>,
    filters: Record<string, unknown>,
    options: FindOptions,
  ): Promise<ListResult<EntityType>> {
    const query = this.queryBuilder.buildSelect(entityType, filters, options);

    logger.debug(`services.database.orm.postgres.find - Query: ${query}`);

    const results = await this.client.query(query[0] as string, query[1] as never[]);

    const { columnsDefinition, entityDefinition } = getEntityDefinition(
      new (entityType as ObjectType<EntityType>)(),
    );
    const entities: EntityType[] = [];
    results.rows.forEach(row => {
      const entity = new (entityType as ObjectType<EntityType>)();
      Object.keys(row).forEach(key => {
        if (columnsDefinition[key]) {
          entity[columnsDefinition[key].nodename] = this.dataTransformer.fromDbString(
            row[key],
            columnsDefinition[key].type,
          );
        }
      });
      entities.push(entity);
    });

    const nextPageToken = options?.pagination?.page_token || "0";
    const limit = parseInt(options?.pagination?.limitStr);
    const nextToken = entities.length === limit && (parseInt(nextPageToken) + limit).toString(10);
    const nextPage: Paginable = new Pagination(nextToken, options?.pagination?.limitStr || "100");
    logger.debug(
      `services.database.orm.postgres.find - Query Result (items=${entities.length}): ${query}`,
    );

    return new ListResult<EntityType>(entityDefinition.type, entities, nextPage);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  remove<Entity>(entities: Entity[]): Promise<boolean[]> {
    return Promise.all(entities.map(entity => this.removeOne(entity)));
  }

  async removeOne<Entity>(entity: Entity): Promise<boolean> {
    const query = this.queryBuilder.buildDelete(entity);
    logger.debug(`service.database.orm.postgres.remove - Query: "${query}"`);
    const result = await this.client.query(query[0] as string, query[1] as never[]);
    return result.rowCount > 0;
  }

  async upsert<Entity>(entities: Entity[], _options: UpsertOptions): Promise<boolean[]> {
    if (!_options?.action) {
      throw new Error("Can't perform unknown operation");
    } else {
      return Promise.all(entities.map(entity => this.upsertOne(entity, _options)));
    }
  }

  private async upsertOne<Entity>(entity: Entity, _options: UpsertOptions): Promise<boolean> {
    if (_options.action == "INSERT") {
      const query = this.queryBuilder.buildInsert(entity);
      return this.execute(query);
    } else if (_options.action == "UPDATE") {
      if (!(await this.execute(this.queryBuilder.buildUpdate(entity)))) {
        return this.execute(this.queryBuilder.buildInsert(entity));
      }
    } else {
      return false;
    }
  }

  private async execute(query: Query) {
    logger.debug(`service.database.orm.postgres - Query: "${query[0]}"`);
    try {
      const result: QueryResult = await this.client.query(query[0] as string, query[1] as never[]);
      return result.rowCount > 0;
    } catch (err) {
      logger.error({ err }, `services.database.orm.postgres - Error with SQL query: ${query[0]}`);
      return false;
    }
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

export type TableRowInfo = {
  table_name: string;
  column_name: string;
  data_type: string;
};
