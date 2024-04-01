import Search from ".";
import { logger } from "../../framework";
import {
  ExecutionContext,
  ListResult,
  Paginable,
  Pagination,
} from "../../framework/api/crud-service";
import { EntityTarget, FindFilter, FindOptions, getEntityDefinition } from "./api";

export default class SearchRepository<EntityType> {
  name = "searchRepository";

  constructor(
    readonly service: Search,
    readonly table: string,
    readonly entityType: EntityTarget<EntityType>,
  ) {}

  /** Execute a search over defined search database (mongo or elastic search) */
  public async search(filters: FindFilter, options: FindOptions = {}, context?: ExecutionContext) {
    logger.debug(
      `${this.name} Run search for table ${this.table} with filter ${JSON.stringify(
        filters,
      )} and options ${JSON.stringify(options)}`,
    );

    const instance = new (this.entityType as any)();
    const { entityDefinition } = getEntityDefinition(instance);
    const repository = await this.service.database.getRepository(this.table, this.entityType);

    const results: EntityType[] = [];
    let nextPage: Paginable = new Pagination();
    try {
      //1. Get objects primary keys from search connector
      const searchResults = await this.service.service.search(
        this.table,
        this.entityType,
        filters,
        options,
      );

      //2. Get database original objects from these primary keys
      for (const searchEntity of searchResults.getEntities().sort((a, b) => b.score - a.score)) {
        const sourceEntity = await repository.findOne(searchEntity.primaryKey, {}, context);
        if (sourceEntity) {
          results.push(sourceEntity);
        } else {
          logger.error(
            `${this.name} Missing source entity for pk ${JSON.stringify(
              searchEntity.primaryKey,
            )} in table ${this.table}`,
          );
        }
      }
      nextPage = searchResults.nextPage;
    } catch (err) {
      logger.error(`${this.name} An error occurred while searching, returning zero results:`);
      logger.error(err);
    }

    logger.debug(`${this.name} Found ${results.length} results for table ${this.table}`);

    return new ListResult(entityDefinition.type, results, nextPage);
  }
}
