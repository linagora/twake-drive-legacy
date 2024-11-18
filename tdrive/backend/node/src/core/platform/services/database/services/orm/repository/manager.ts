import { logger } from "../../../../../../../core/platform/framework";
import DatabaseService from "../..";
import Repository from "./repository";
import CachingRepository, { loadConfig as loadCachingConfig } from "./caching-repository";
import { EntityTarget } from "../types";

export class RepositoryManager {
  private static toCacheEntities = new Map<string, string[]>();
  /** When an entity is called with a key, registry instances from `getRepository` will be {@link CachingRepository} */
  public static registerEntityToCacheRegistryBy(table: string, keys: string[]) {
    this.toCacheEntities.set(table, keys);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private repositories: Map<string, Repository<any>> = new Map<string, Repository<any>>();

  constructor(private databaseService: DatabaseService) {}

  async getRepository<Entity>(
    table: string,
    entity: EntityTarget<Entity>,
  ): Promise<Repository<Entity>> {
    if (!this.repositories.has(table)) {
      const cacheKeys = loadCachingConfig() && RepositoryManager.toCacheEntities.get(table);
      const repository = cacheKeys
        ? new CachingRepository<Entity>(
            this.databaseService.getConnector(),
            table,
            entity,
            cacheKeys,
          )
        : new Repository<Entity>(this.databaseService.getConnector(), table, entity);

      try {
        await repository.init();
      } catch (err) {
        logger.error({ err }, "Error while initializing repository");
        throw new Error("Can not initialize repository");
      }

      this.repositories.set(table, repository);
    }

    return this.repositories.get(table);
  }
}
