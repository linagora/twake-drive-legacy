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
import {
  TDiagnosticResult,
  TServiceDiagnosticDepth,
} from "../../../../../../framework/api/diagnostics";

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

/** Reconnection tuning constants */
const RECONNECT_BASE_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 30_000;
const RECONNECT_MAX_RETRIES = 10;

export class PostgresConnector extends AbstractConnector<PostgresConnectionOptions> {
  private logger = getLogger("PostgresConnector");
  private client: Client;
  private connected = false;
  private reconnecting = false;
  private reconnectPromise: Promise<void> | null = null;
  private intentionalDisconnect = false;
  private dataTransformer = new PostgresDataTransformer({ secret: this.secret });
  private queryBuilder = new PostgresQueryBuilder(this.secret);

  private async healthcheck(): Promise<void> {
    const result: QueryResult = await this.client.query("SELECT NOW()");
    if (!result || result.rowCount != 1) {
      throw new Error("Connection Error");
    }
    this.logger.info(`DB connection is fine, current time is ${result.rows[0].now}`);
  }

  /**
   * Create a fresh pg Client and attach error/end listeners that
   * trigger automatic reconnection when the server drops the connection.
   */
  private createClient(): Client {
    const client = new Client(this.options);

    client.on("error", (err: Error) => {
      this.logger.error(
        { err },
        "PostgreSQL connection lost — server terminated the connection",
      );
      this.connected = false;
      if (!this.intentionalDisconnect) {
        this.scheduleReconnect();
      }
    });

    client.on("end", () => {
      this.connected = false;
      if (!this.intentionalDisconnect) {
        this.logger.warn("PostgreSQL connection ended unexpectedly");
        this.scheduleReconnect();
      }
    });

    return client;
  }

  async connect(): Promise<this> {
    this.intentionalDisconnect = false;
    this.client = this.createClient();
    this.logger.info("Connecting to DB");
    await this.client.connect();
    this.connected = true;
    this.logger.info("Connection pool created");
    await this.healthcheck();
    return this;
  }

  async disconnect(): Promise<this> {
    this.intentionalDisconnect = true;
    if (this.client) {
      await this.client.end();
    }
    this.client = null;
    this.connected = false;
    return this;
  }

  /**
   * Trigger a reconnect attempt if one is not already in progress.
   * Safe to call multiple times — subsequent calls share the same promise.
   */
  private scheduleReconnect(): void {
    if (this.reconnecting) return;
    this.reconnectPromise = this.reconnectWithBackoff();
  }

  /**
   * Attempt to re-establish the connection with exponential back-off.
   * Retries up to RECONNECT_MAX_RETRIES times before giving up.
   */
  private async reconnectWithBackoff(): Promise<void> {
    if (this.reconnecting) return;
    this.reconnecting = true;

    let attempt = 0;
    while (attempt < RECONNECT_MAX_RETRIES) {
      attempt++;
      const delay = Math.min(
        RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt - 1),
        RECONNECT_MAX_DELAY_MS,
      );

      this.logger.info(
        `PostgreSQL reconnect attempt ${attempt}/${RECONNECT_MAX_RETRIES} in ${delay}ms`,
      );
      await this.sleep(delay);

      try {
        // Dispose the old client silently — it is already dead
        try {
          this.client?.end().catch(() => {});
        } catch {
          // ignore cleanup errors on dead client
        }

        this.client = this.createClient();
        await this.client.connect();
        this.connected = true;
        this.reconnecting = false;
        this.reconnectPromise = null;
        this.logger.info(
          `PostgreSQL connection recovered after ${attempt} attempt(s)`,
        );
        return;
      } catch (err) {
        this.logger.warn(
          { err },
          `PostgreSQL reconnect attempt ${attempt}/${RECONNECT_MAX_RETRIES} failed`,
        );
      }
    }

    this.reconnecting = false;
    this.reconnectPromise = null;
    this.logger.error(
      `PostgreSQL reconnection failed after ${RECONNECT_MAX_RETRIES} attempts — giving up. ` +
        "Manual restart may be required.",
    );
  }

  /**
   * Ensure the client is connected before running a query.
   * If a reconnect is in progress, wait for it to finish.
   * If the connection is down and no reconnect is running, trigger one.
   */
  private async ensureConnection(): Promise<void> {
    if (this.connected) return;

    if (this.reconnectPromise) {
      await this.reconnectPromise;
    }

    if (!this.connected) {
      // No reconnect was in progress and we are still disconnected — try now
      this.scheduleReconnect();
      if (this.reconnectPromise) {
        await this.reconnectPromise;
      }
    }

    if (!this.connected) {
      throw new Error(
        "PostgreSQL connection is not available and reconnection failed",
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async ping(): Promise<boolean> {
    const wasConnected = this.connected;
    if (wasConnected) await this.healthcheck();
    else await this.connect();
    return !wasConnected;
  }

  async getDiagnostics(depth: TServiceDiagnosticDepth): Promise<TDiagnosticResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const safeRequest = async (query: string, values?: any[], singleRow = false) => {
      try {
        await this.ensureConnection();
        const rows = (await this.client.query(query, values)).rows;
        return singleRow && rows?.length === 1 ? rows[0] : rows;
      } catch (err) {
        const logId = "pg-diags-error-" + Math.floor(process.uptime() * 1000);
        logger.error(
          { err, query, values, logId, errCode: err.code },
          `Error running postgresql statistics at ${depth} ( ${logId} ) `,
        );
        return { error: true, logId };
      }
    };
    switch (depth) {
      // This is the only required `ok`
      case TServiceDiagnosticDepth.alive:
        return { ok: true, didConnect: await this.ping() };

      // Statistics can silently fail, and do it granularly if there is
      // a permission issue only on some of the stats
      case TServiceDiagnosticDepth.stats_track:
        return {
          ok: true,
          db: await safeRequest(
            "select * from pg_stat_database where datname = $1",
            [this.options.database],
            true,
          ),
        };
      case TServiceDiagnosticDepth.stats_basic:
        return { ok: true, empty: true };
      case TServiceDiagnosticDepth.stats_deep:
        return {
          ok: true,
          databases: await safeRequest("select * from pg_stat_database"),
          tables: await safeRequest("select * from pg_stat_user_tables"),
          indexes: await safeRequest("select * from pg_stat_user_indexes"),
        };

      default:
        throw new Error(`Unexpected TServiceDiagnosticDepth: ${JSON.stringify(depth)}`);
    }
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
      await this.ensureConnection();
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
          await this.ensureConnection();
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
        await this.ensureConnection();
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
        await this.ensureConnection();
        const queryResult: QueryResult = await this.client.query(alterQuery);
        this.logger.info(`Table is altered with the result ${queryResult}`);
      }
    }
  }

  async drop(): Promise<this> {
    const query = `
        DO $$
        DECLARE
          tablename text;
        BEGIN
          FOR tablename IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public')
          LOOP
            EXECUTE 'DELETE FROM  "' || tablename || '" CASCADE';
          END LOOP;
        END $$;`;
    logger.debug(`service.database.orm.postgres.drop - Query: "${query}"`);
    await this.ensureConnection();
    await this.client.query(query);
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
    await this.ensureConnection();
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

    await this.ensureConnection();
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

    const nextPage = this.nextPage(options.pagination, entities.length);
    logger.debug(
      `services.database.orm.postgres.find - Query Result (items=${entities.length}): ${query}`,
    );

    return new ListResult<EntityType>(entityDefinition.type, entities, nextPage);
  }

  nextPage(pagination: Pagination, entitiesLength: number) {
    const nextPageToken = pagination?.page_token || "0";
    const limit = parseInt(pagination?.limitStr);
    const nextToken = entitiesLength === limit && (parseInt(nextPageToken) + 1).toString(10);
    const nextPage: Paginable = new Pagination(nextToken, pagination?.limitStr || "100");
    return nextPage;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  remove<Entity>(entities: Entity[]): Promise<boolean[]> {
    return Promise.all(entities.map(entity => this.removeOne(entity)));
  }

  async removeOne<Entity>(entity: Entity): Promise<boolean> {
    const query = this.queryBuilder.buildDelete(entity);
    logger.debug(`service.database.orm.postgres.remove - Query: "${query}"`);
    await this.ensureConnection();
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
      throw new Error("Missing or unknown UpsertOptions.action");
    }
  }

  async atomicCompareAndSet<Entity, FieldValueType>(
    entity: Entity,
    fieldName: keyof Entity,
    previousValue: FieldValueType,
    newValue: FieldValueType,
  ): Promise<{
    didSet: boolean;
    currentValue: FieldValueType | null;
  }> {
    const { updateQuery, getValueQuery } = this.queryBuilder.buildatomicCompareAndSet(
      entity,
      fieldName,
      previousValue,
      newValue,
    );
    const result = await this.executeRaw(updateQuery);
    if (!result)
      throw new Error(
        `Error updating ${JSON.stringify(fieldName)} field of ${JSON.stringify(
          entity["id"],
        )} from ${JSON.stringify(previousValue)} to ${JSON.stringify(
          newValue,
        )}. Search logs for 'services.database.orm.postgres - Error with SQL query'`,
      );
    if (result.rowCount > 1)
      throw new Error(
        `Unexpected modified count ${JSON.stringify(result)} on postgres update(${JSON.stringify(
          updateQuery,
        )})`,
      );
    let currentValue = newValue;
    if (result.rowCount == 0) {
      const readValue = await this.executeRaw(getValueQuery);
      if (readValue.rows.length == 0)
        throw new Error(
          `Error setting ${fieldName as string} atomically, no row matched PK: ${JSON.stringify(
            getValueQuery,
          )}`,
        );
      currentValue = readValue.rows[0][readValue.fields[0].name];
    }
    return {
      didSet: result.rowCount > 0,
      currentValue,
    };
  }

  private async executeRaw(query: Query): Promise<QueryResult | null> {
    logger.debug(`service.database.orm.postgres - Query: "${query[0]}"`);
    try {
      await this.ensureConnection();
      return await this.client.query(query[0] as string, query[1] as never[]);
    } catch (err) {
      logger.error({ err }, `services.database.orm.postgres - Error with SQL query: ${query[0]}`);
      return null;
    }
  }

  private async execute(query: Query) {
    const result = await this.executeRaw(query);
    return result && result.rowCount > 0;
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
      await this.ensureConnection();
      const dbResult: QueryResult<TableRowInfo> = await this.client.query(query, [name]);
      return dbResult.rows.map(row => row.column_name);
    } catch (err) {
      this.logger.warn("Error querying table information", err);
      throw err;
    }
  }

  getOffsetPagination(options: Paginable): Pagination {
    const { page_token, limitStr } = options;
    const pageNumber = parseInt(page_token) / parseInt(limitStr);
    return new Pagination(`${pageNumber}`, `${limitStr}`, options.reversed);
  }
}

export type TableRowInfo = {
  table_name: string;
  column_name: string;
  data_type: string;
};
