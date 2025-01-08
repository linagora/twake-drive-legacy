import { TdriveService, logger, ServiceName, Consumes } from "../../framework";
import {
  DatabaseEntitiesRemovedEvent,
  DatabaseEntitiesSavedEvent,
  EntityTarget,
  ESSearchConfiguration,
  SearchAdapterInterface,
  SearchConfiguration,
  SearchServiceAPI,
} from "./api";
import ESAndOpenSearch from "./adapters/elasticsearch/elastic-open-search-adapter";
import MongosearchService from "./adapters/mongosearch";
import { localEventBus } from "../../framework/event-bus";
import { DatabaseServiceAPI } from "../database/api";
import SearchRepository from "./repository";
import { Client as OpenClient } from "@opensearch-project/opensearch";
import { Client as ESClient } from "@elastic/elasticsearch";
import { SearchDocumentsOptions } from "src/services/documents/types";

@ServiceName("search")
@Consumes(["database"])
export default class Search extends TdriveService<SearchServiceAPI> {
  version = "1";
  name = "search";
  service: SearchAdapterInterface;
  database: DatabaseServiceAPI;
  type: SearchConfiguration["type"];

  public async doInit(): Promise<this> {
    const type = this.configuration.get("type") as SearchConfiguration["type"];
    this.type = type;
    this.database = this.context.getProvider<DatabaseServiceAPI>("database");

    if (type === "elasticsearch") {
      logger.info("Loaded Elasticsearch adapter for search.");
      this.service = new ESAndOpenSearch(
        this.database,
        this.configuration.get("elasticsearch") as ESSearchConfiguration,
        config => new ESClient(config),
        "ElasticSearch",
      );
    } else if (type === "opensearch") {
      logger.info("Loaded OpenSearch adapter for search.");
      this.service = new ESAndOpenSearch(
        this.database,
        this.configuration.get("opensearch") as ESSearchConfiguration,
        config => new OpenClient(config),
        "OpenSearch",
      );
    } else if (type === "mongodb") {
      logger.info("Loaded Mongo adapter for search.");
      this.service = new MongosearchService(this.database);
    } else {
      logger.warn("No adapter for search was loaded.");
      this.service = null;
    }

    if (this.service) await this.service.connect();
    return this;
  }

  //Subscribe to local event bus to get entities to store to es
  public async doStart(): Promise<this> {
    if (!this.service) return this;

    localEventBus.subscribe("database:entities:saved", (event: DatabaseEntitiesSavedEvent) => {
      this.service.upsert(event.entities);
    });

    localEventBus.subscribe("database:entities:removed", (event: DatabaseEntitiesRemovedEvent) => {
      this.service.remove(event.entities);
    });

    return this;
  }

  public async doStop(): Promise<this> {
    if (this.service) {
      await this.service.disconnect();
      this.service = null;
    }
    return this;
  }

  public async upsert(entities: never[]) {
    return this.service.upsert(entities);
  }

  public async remove(entities: never[]) {
    return this.service.remove(entities);
  }

  public getRepository<EntityType>(table: string, entityType: EntityTarget<EntityType>) {
    return new SearchRepository(this, table, entityType);
  }

  api(): SearchServiceAPI {
    return this;
  }

  handlePagination(options: SearchDocumentsOptions): void {
    if (this.type === "mongodb") {
      // No custom pagination logic for MongoDB
      return;
    }

    if (this.type === "elasticsearch" || this.type === "opensearch") {
      if (options.nextPage?.page_token) {
        // Set the scroll ID as the page token
        options.pagination = {
          ...options.pagination,
          page_token: options.nextPage.page_token,
        };
      } else {
        // Clear pagination if no nextPage token is provided
        options.pagination = {
          limitStr: options.pagination?.limitStr,
        };
      }
      return;
    }

    // Handle unsupported platform types
    throw new Error(`Pagination handling is not implemented for platform type: ${this.type}`);
  }
}
