import * as mongo from "mongodb";
import { UpsertOptions } from "..";
import { ListResult, Paginable, Pagination } from "../../../../../../framework/api/crud-service";
import { FindOptions } from "../../repository/repository";
import { ColumnDefinition, EntityDefinition, ObjectType } from "../../types";
import { getEntityDefinition, unwrapPrimarykey } from "../../utils";
import { AbstractConnector } from "../abstract-connector";
import { buildSelectQuery } from "./query-builder";
import { transformValueFromDbString, transformValueToDbString } from "./typeTransforms";
import { logger } from "../../../../../../framework";

export interface MongoConnectionOptions {
  // TODO: More options
  uri: string;
  database: string;
}

export class MongoConnector extends AbstractConnector<MongoConnectionOptions> {
  private client: mongo.MongoClient;

  async init(): Promise<this> {
    if (!this.client) {
      await this.connect();
    }
    return this;
  }

  async connect(): Promise<this> {
    if (this.client) {
      return this;
    }

    this.client = new mongo.MongoClient(this.options.uri);
    await this.client.connect();

    return this;
  }

  async disconnect(): Promise<this> {
    if (this.client) await this.client.close();
    this.client = null;
    return this;
  }

  getClient(): mongo.MongoClient {
    return this.client;
  }

  async getDatabase(): Promise<mongo.Db> {
    await this.connect();
    return this.client.db(this.options.database);
  }

  async drop(): Promise<this> {
    const db = await this.getDatabase();

    await db.dropDatabase();

    return this;
  }

  async createTable(
    _entity: EntityDefinition,
    _columns: { [name: string]: ColumnDefinition },
  ): Promise<boolean> {
    const db = await this.getDatabase();
    const collection = db.collection(`${_entity.name}`);

    //Mongo only need to create an index if ttl defined for entity
    if (_entity.options.ttl && _entity.options.ttl > 0) {
      const primaryKey = unwrapPrimarykey(_entity);
      const filter: any = {};
      primaryKey.forEach(key => {
        filter[key] = 1;
      });
      collection.createIndex(filter, { expireAfterSeconds: _entity.options.ttl });
    }

    return true;
  }
  async upsert(entities: any[], _options: UpsertOptions = {}): Promise<boolean[]> {
    logger.trace(`services.database.orm.mongodb.upsert - entities count: ${entities.length}`);
    return new Promise(async resolve => {
      const promises: Promise<mongo.UpdateResult>[] = [];

      const db = await this.getDatabase();

      entities.forEach(entity => {
        const { columnsDefinition, entityDefinition } = getEntityDefinition(entity);
        const primaryKey = unwrapPrimarykey(entityDefinition);
        logger.trace(
          `services.database.orm.mongodb.upsert[${_options.action}] - Entity{${
            entityDefinition.name
          }: ${JSON.stringify(entity)}`,
        );

        //Set updated content
        const set: any = {};
        const inc: any = {};
        Object.keys(columnsDefinition)
          .filter(key => primaryKey.indexOf(key) === -1)
          .filter(key => columnsDefinition[key].nodename !== undefined)
          .forEach(key => {
            const value = transformValueToDbString(
              entity[columnsDefinition[key].nodename],
              columnsDefinition[key].type,
              {
                columns: columnsDefinition[key].options,
                secret: this.secret,
                column: { key },
              },
            );

            if (columnsDefinition[key].type === "counter") {
              inc[key] = value;
            } else {
              set[key] = value;
            }
          });

        //Set primary key
        const where: any = {};
        primaryKey.forEach(key => {
          where[key] = transformValueToDbString(
            entity[columnsDefinition[key].nodename],
            columnsDefinition[key].type,
            {
              columns: columnsDefinition[key].options,
              secret: this.secret,
              disableSalts: true,
              column: { key },
            },
          );
        });

        const collection = db.collection(`${entityDefinition.name}`);

        const updateObject = { $set: { ...where, ...set } } as any;

        if (Object.keys(inc).length) {
          updateObject.$inc = inc;
        }

        promises.push(
          collection.updateOne(where, updateObject, {
            upsert: true,
          }) as Promise<mongo.UpdateResult>,
        );
      });

      Promise.all(promises).then(results => {
        resolve(results.map(result => result.acknowledged));
      });
    });
  }

  async remove(entities: any[]): Promise<boolean[]> {
    return new Promise(async resolve => {
      const promises: Promise<mongo.DeleteResult>[] = [];
      const db = await this.getDatabase();

      entities.forEach(entity => {
        const { columnsDefinition, entityDefinition } = getEntityDefinition(entity);
        const primaryKey = unwrapPrimarykey(entityDefinition);

        //Set primary key
        const where: any = {};
        primaryKey.forEach(key => {
          where[key] = transformValueToDbString(
            entity[columnsDefinition[key].nodename],
            columnsDefinition[key].type,
            {
              columns: columnsDefinition[key].options,
              secret: this.secret,
              disableSalts: true,
              column: { key },
            },
          );
        });

        const collection = db.collection(`${entityDefinition.name}`);
        promises.push(collection.deleteOne(where));
      });

      Promise.all(promises).then(results => {
        resolve(results.map(result => result.acknowledged));
      });
    });
  }

  async find<Table>(
    entityType: Table,
    filters: any,
    options: FindOptions = {},
  ): Promise<ListResult<Table>> {
    const instance = new (entityType as any)();
    const { columnsDefinition, entityDefinition } = getEntityDefinition(instance);

    const db = await this.getDatabase();
    const collection = db.collection(`${entityDefinition.name}`);

    const query = buildSelectQuery<Table>(
      entityType as unknown as ObjectType<Table>,
      filters,
      options,
    );

    let sort: any = {};
    for (const key of entityDefinition.options.primaryKey.slice(1)) {
      const defaultOrder =
        (columnsDefinition[key as string].options.order || "ASC") === "ASC" ? 1 : -1;
      sort[key as string] = (options?.pagination?.reversed ? -1 : 1) * defaultOrder;
    }
    if (options?.sort) {
      sort = options.sort
        ? Object.fromEntries(
            Object.entries(options.sort).map(([field, direction]) => [
              field,
              direction === "asc" ? 1 : -1,
            ]),
          )
        : {};
    }

    logger.debug(`services.database.orm.mongodb.find - Query: ${JSON.stringify(query)}`);

    const cursor = collection
      .find(query)
      .sort(sort)
      .skip(Math.max(0, parseInt(options.pagination.page_token || "0")))
      .limit(Math.max(0, parseInt(options.pagination.limitStr || "100"))).collation({
        locale: "en_US", numericOrdering: true
      });

    const entities: Table[] = [];
    while (await cursor.hasNext()) {
      let row = await cursor.next();
      row = { ...row.set, ...row };
      const entity = new (entityType as any)();
      Object.keys(row)
        .filter(key => columnsDefinition[key] !== undefined)
        .forEach(key => {
          entity[columnsDefinition[key].nodename] = transformValueFromDbString(
            row[key],
            columnsDefinition[key].type,
            { columns: columnsDefinition[key].options, secret: this.secret },
          );
        });
      entities.push(entity);
    }

    const nextPageToken = options.pagination.page_token || "0";
    const limit = parseInt(options.pagination.limitStr);
    const nextToken = entities.length === limit && (parseInt(nextPageToken) + limit).toString(10);
    const nextPage: Paginable = new Pagination(nextToken, options.pagination.limitStr || "100");
    return new ListResult<Table>(entityDefinition.type, entities, nextPage);
  }
}
