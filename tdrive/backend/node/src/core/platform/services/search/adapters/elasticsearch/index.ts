import { Client } from "@elastic/elasticsearch";
import { logger } from "../../../../framework";
import _ from "lodash";
import {
  ColumnDefinition,
  EntityDefinition,
  EntityTarget,
  FindFilter,
  FindOptions,
  IndexedEntity,
  SearchAdapterInterface,
  SearchConfiguration,
} from "../../api";
import { SearchAdapter } from "../abstract";
import { DatabaseServiceAPI } from "../../../database/api";
import { getEntityDefinition, unwrapPrimarykey } from "../../api";
import { ListResult, Paginable, Pagination } from "../../../../framework/api/crud-service";
import { asciiFold, parsePrimaryKey, stringifyPrimaryKey } from "../utils";
import { ApiResponse } from "@elastic/elasticsearch/lib/Transport";
import { buildSearchQuery } from "./search";

type Operation = {
  index?: { _index: string; _id: string };
  delete?: { _index: string; _id: string };
  [key: string]: any;
};

export default class ElasticSearch extends SearchAdapter implements SearchAdapterInterface {
  private client: Client;
  private bulkReaders = 0;
  private buffer: Operation[] = [];
  private name = "ElasticSearch";

  constructor(
    readonly database: DatabaseServiceAPI,
    readonly configuration: SearchConfiguration["elasticsearch"],
  ) {
    super();
  }

  public async connect() {
    try {
      let clientOptions: any = {
        node: this.configuration.endpoint,
        ssl: {
          rejectUnauthorized: false,
        },
      };

      if (this.configuration.useAuth) {
        logger.info(`Using auth for ES client`);
        clientOptions.auth = {
          username: this.configuration.username,
          password: this.configuration.password,
        };
      }

      this.client = new Client(clientOptions);
    } catch (e) {
      logger.error(
        `Unable to connect to ElasticSearch for options: ${JSON.stringify({
          node: this.configuration.endpoint,
          auth: {
            useAuth: this.configuration.useAuth,
            username: this.configuration.username,
            password: this.configuration.password,
          },
          ssl: {
            rejectUnauthorized: false,
          },
        })} at: ${this.configuration.endpoint}`,
      );
    }
    this.startBulkReader();
  }

  private async createIndex(
    entity: EntityDefinition,
    _columns: { [name: string]: ColumnDefinition },
  ) {
    if (!entity.options?.search) {
      return;
    }

    const name = entity.options?.search?.index || entity.name;
    const mapping = entity.options?.search?.esMapping;

    try {
      await this.client.indices.get({
        index: name,
      });
      logger.info(`Index "${name}" already created`);
    } catch (e) {
      logger.info(`Create index ${name} with mapping %o`, mapping);

      const indice = {
        index: name,
        body: {
          settings: {
            analysis: {
              analyzer: {
                folding: {
                  tokenizer: "standard",
                  filter: ["lowercase", "asciifolding"],
                },
              },
            },
          },
          mappings: { ...mapping, _source: { enabled: false } },
        },
      };

      const rep = await this.client.indices.create(indice, { ignore: [400] });

      if (rep.statusCode !== 200) {
        logger.error(`${this.name} -  ${JSON.stringify(rep.body)}`);
      }
    }
  }

  public async upsert(entities: any[]) {
    for (const entity of entities) {
      const { entityDefinition, columnsDefinition } = getEntityDefinition(entity);
      const pkColumns = unwrapPrimarykey(entityDefinition);

      await this.ensureIndex(entityDefinition, columnsDefinition, this.createIndex.bind(this));

      if (!entityDefinition.options?.search) {
        return;
      }

      if (
        entityDefinition.options.search.shouldUpdate &&
        !entityDefinition.options.search.shouldUpdate(entity)
      ) {
        return;
      }

      if (!entityDefinition.options?.search?.source) {
        logger.info(`Unable to do operation upsert to elasticsearch for doc ${entity}`);
        return;
      }

      const body = {
        ..._.pick(entity, ...pkColumns),
        ...entityDefinition.options.search.source(entity),
      };

      Object.keys(entityDefinition.options?.search.esMapping?.properties || []).forEach(
        (key: string) => {
          const mapping: any = entityDefinition.options?.search?.esMapping?.properties[key];
          if (mapping.type === "text") {
            body[key] = asciiFold(body[key]).toLocaleLowerCase();
          }
        },
      );

      const index = entityDefinition.options?.search?.index || entityDefinition.name;

      const record: Operation = {
        index: {
          _index: index,
          _id: stringifyPrimaryKey(entity),
        },
        ...body,
      };

      logger.info(`Add operation upsert to elasticsearch for doc ${record.id}`);

      this.buffer.push(record);
    }

    this.startBulkReader();
  }

  public async remove(entities: any[]) {
    for (const entity of entities) {
      const { entityDefinition, columnsDefinition } = getEntityDefinition(entity);

      await this.ensureIndex(entityDefinition, columnsDefinition, this.createIndex.bind(this));

      if (!entityDefinition.options?.search) {
        return;
      }

      const index = entityDefinition.options?.search?.index || entityDefinition.name;

      const record: Operation = {
        delete: {
          _index: index,
          _id: stringifyPrimaryKey(entity),
        },
      };

      logger.info(`Add operation remove from elasticsearch for doc ${record.id}`);

      this.buffer.push(record);
    }

    this.startBulkReader();
  }

  private async startBulkReader() {
    if (this.bulkReaders > 0) {
      return;
    }

    logger.info("Start new Elasticsearch bulk reader.");
    this.bulkReaders += 1;

    let buffer;
    do {
      await new Promise(r =>
        setTimeout(r, parseInt(`${this.configuration.flushInterval}`) || 3000),
      );
      buffer = this.buffer;
    } while (buffer.length === 0);
    this.buffer = [];

    try {
      await this.client.helpers.bulk({
        flushInterval: 1,
        datasource: buffer,
        onDocument: (doc: Operation) => {
          if (doc.delete) {
            logger.info(
              `Operation ${"DELETE"} pushed to elasticsearch index ${doc.delete._index} (doc.id: ${
                doc.delete._id
              })`,
            );
            return {
              delete: doc.delete,
            };
          }
          if (doc.index) {
            logger.info(
              `Operation ${"INDEX"} pushed to elasticsearch index ${doc.index._index} (doc.id: ${
                doc.index._id
              })`,
            );
            return {
              index: doc.index,
              ...doc.index,
            };
          }
          return null;
        },
        onDrop: res => {
          const doc = res.document;
          logger.error(
            `Operation ${
              doc.action
            } was droped while pushing to elasticsearch index ${JSON.stringify(
              doc.index,
            )} (doc.id: ${doc.id})`,
          );
          logger.error(res.error);
        },
      });
    } catch (err) {
      logger.error(`${this.name} - An error occured with the bulk reader`);
      logger.error(err);
    }

    logger.info("Elasticsearch bulk flushed.");
    this.bulkReaders += -1;

    this.startBulkReader();
  }

  public async search<EntityType>(
    _table: string,
    entityType: EntityTarget<EntityType>,
    filters: FindFilter,
    options: FindOptions = {},
  ) {
    const instance = new (entityType as any)();
    const { entityDefinition } = getEntityDefinition(instance);

    const { esParams, esOptions } = buildSearchQuery<EntityType>(entityType, filters, options);
    const esParamsWithScroll = {
      ...esParams,
      size: parseInt(options.pagination.limitStr || "100"),
      scroll: "1m",
    };

    let esResponse: ApiResponse;

    if (options.pagination.page_token) {
      esResponse = await this.client.scroll(
        {
          scroll_id: options.pagination.page_token,
        },
        esOptions,
      );
    } else {
      esResponse = await this.client.search(esParamsWithScroll, esOptions);
    }

    if (esResponse.statusCode !== 200) {
      logger.error(`${this.name} -  ${JSON.stringify(esResponse.body)}`);
    }

    const nextToken = esResponse.body?._scroll_id || "";
    const hits = esResponse.body?.hits?.hits || [];

    logger.debug(`${this.name} got response: ${JSON.stringify(esResponse)}`);

    const entities: IndexedEntity[] = [];
    for await (const hit of hits) {
      try {
        entities.push({
          primaryKey: parsePrimaryKey(entityDefinition, hit._id),
          score: hit._score,
        });
      } catch (err) {
        logger.error(
          `${this.name} failed to get entity from search result: ${JSON.stringify(
            hit._id,
          )}, ${JSON.stringify(err)}`,
        );
      }
    }

    const nextPage: Paginable = new Pagination(nextToken, options.pagination.limitStr || "100");

    return new ListResult(entityDefinition.type, entities, nextPage);
  }
}
