import { AbstractConnector } from "../abstract-connector";
import { ColumnDefinition, ColumnOptions, ColumnType, EntityDefinition } from "../../types";
import { ListResult } from "../../../../../../framework/api/crud-service";
import { FindOptions } from "../../repository/repository";
import { Client, QueryResult } from "pg";
import { getLogger, logger } from "../../../../../../framework";
import { getEntityDefinition, unwrapPrimarykey } from "../../../orm/utils";
import { isBoolean, isInteger, isNull, isUndefined } from "lodash";
import { decrypt, encrypt } from "../../../../../../../../core/crypto";
import { UpsertOptions } from "src/core/platform/services/database/services/orm/connectors";

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

  //TODO[ASH] generate one update or insert query with multiple value sets,
  //It will be significant optimisation for the batch updates
  async upsert(entities: any[], _options: UpsertOptions): Promise<boolean[]> {
    if (!_options?.action) {
      throw new Error("Can't perform unknown operation");
    }
    if (entities && entities.length == 1) {
      // for one row do it without transaction
      return [await this.upsertOne(entities[0], this.client, _options)];
    } else {
      //TODO[ASH] add transaction here
      // const client: Client = new Client(this.options);
      return await Promise.all(
        entities.map(entity => this.upsertOne(entity, this.client, _options)),
      );
    }
  }

  private async upsertOne(entity: any, client: Client, _options: UpsertOptions): Promise<boolean> {
    const { columnsDefinition, entityDefinition } = getEntityDefinition(entity);
    const primaryKey = unwrapPrimarykey(entityDefinition);

    const toValueKeyDBStringPair = (key: string) => {
      return [
        key,
        transformValueToDbString(
          entity[columnsDefinition[key].nodename],
          columnsDefinition[key].type,
          {
            columns: columnsDefinition[key].options,
            secret: this.secret,
            column: { key },
          },
        ),
      ];
    };

    let query: string;
    let values = [];
    if (_options.action == "INSERT") {
      const fields = Object.keys(columnsDefinition)
        .filter(key => entity[columnsDefinition[key].nodename] !== undefined)
        .map(key => toValueKeyDBStringPair(key));
      query = `INSERT INTO ${entityDefinition.name} (${fields.map(e => e[0]).join(", ")}) 
                VALUES (${fields.map((e, idx) => `$${idx + 1}`).join(", ")})`;
      values = fields.map(f => f[1]);
    } else if (_options.action == "UPDATE") {
      // Set updated content
      const set = Object.keys(columnsDefinition)
        .filter(key => primaryKey.indexOf(key) === -1)
        .filter(key => entity[columnsDefinition[key].nodename] !== undefined)
        .map(key => toValueKeyDBStringPair(key));
      //Set primary key
      const where = primaryKey.map(key => toValueKeyDBStringPair(key));
      //Start index for where clause params
      const whereIdx = set.length + 1;
      query = `UPDATE ${entityDefinition.name} 
                SET ${set.map((e, idx) => `${e[0]} = $${idx + 1}`).join(", ")} 
                WHERE ${where.map((e, idx) => `${e[0]} = $${whereIdx + idx}`).join(" AND ")}`;
      values.push(...set.map(f => f[1]));
      values.push(...where.map(f => f[1]));
    } else {
      return false;
    }

    logger.debug(`service.database.orm.upsert - Query: "${query}"`);

    try {
      const result: QueryResult = await client.query(query, values);
      return result.rowCount == 1;
    } catch (err) {
      logger.error({ err }, `services.database.orm.cassandra - Error with CQL query: ${query}`);
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

const typeMappings = {
  encoded_string: "TEXT",
  encoded_json: "TEXT",
  json: "TEXT",
  string: "TEXT",
  number: "BIGINT",
  timeuuid: "UUID",
  uuid: "UUID",
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

type TransformOptions = {
  secret?: any;
  disableSalts?: boolean;
  columns?: ColumnOptions;
  column?: any;
};

export const transformValueToDbString = (
  v: any,
  type: ColumnType,
  options: TransformOptions = {},
): any => {
  if (type === "number" || type === "tdrive_int" || type === "tdrive_datetime") {
    if (isNull(v) || isNaN(v)) {
      return "null";
    }
    return parseInt(v);
  }
  if (type === "uuid" || type === "timeuuid") {
    if (isNull(v)) {
      return null;
    }
    return (v || "").toString();
  }
  if (type === "boolean" || type === "tdrive_boolean") {
    //Security to avoid string with "false" in it
    if (!isInteger(v) && !isBoolean(v) && !isNull(v) && !isUndefined(v)) {
      throw new Error(`'${v}' is not a ${type}`);
    }
    return !!v;
  }
  if (type === "encoded_string" || type === "encoded_json") {
    if (type === "encoded_json") {
      try {
        v = JSON.stringify(v);
      } catch (err) {
        v = null;
      }
    }
    const encrypted = encrypt(v, options.secret, { disableSalts: options.disableSalts });
    return `${(encrypted.data || "").toString().replace(/'/gm, "''")}`;
  }
  if (type === "string" || type === "json") {
    if (type === "json" && v !== null) {
      try {
        v = JSON.stringify(v);
      } catch (err) {
        v = null;
      }
    }
    return (v || "").toString();
  }

  if (type === "blob" || type === "counter") {
    throw new Error("Not implemented yet");
  }
  return (v || "").toString();
};

export const transformValueFromDbString = (
  v: any,
  type: string,
  options: TransformOptions = {},
): any => {
  logger.trace(`Transform value %o of type ${type}`, v);

  if (type === "tdrive_datetime") {
    return new Date(`${v}`).getTime();
  }

  if (v !== null && (type === "encoded_string" || type === "encoded_json")) {
    let decryptedValue: any;

    if (typeof v === "string" && v.trim() === "") {
      return v;
    }

    try {
      decryptedValue = decrypt(v, options.secret).data;
    } catch (err) {
      logger.debug(`Can not decrypt data (${err.message}) %o of type ${type}`, v);

      decryptedValue = v;
    }

    if (type === "encoded_json") {
      try {
        decryptedValue = JSON.parse(decryptedValue);
      } catch (err) {
        logger.debug(
          { err },
          `Can not parse JSON from decrypted data %o of type ${type}`,
          decryptedValue,
        );
        decryptedValue = null;
      }
    }

    return decryptedValue;
  }

  if (type === "tdrive_boolean" || type === "boolean") {
    return Boolean(v).valueOf();
  }

  if (type === "json") {
    try {
      return JSON.parse(v);
    } catch (err) {
      return null;
    }
  }

  if (type === "uuid" || type === "timeuuid") {
    return v ? String(v).valueOf() : null;
  }

  if (type === "number") {
    return Number(v).valueOf();
  }

  if (type === "counter") {
    return Number(v).valueOf();
  }

  return v;
};
