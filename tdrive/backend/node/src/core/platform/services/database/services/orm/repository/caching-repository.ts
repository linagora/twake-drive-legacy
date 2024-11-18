import Repository, { AtomicCompareAndSetResult, FindFilter, FindOptions } from "./repository";
import { logger } from "../../../../../../../core/platform/framework";
import { ExecutionContext } from "../../../../../framework/api/crud-service";
import { Connector } from "../connectors";
import { EntityTarget } from "../types";
import NodeCache from "node-cache";
import config from "../../../../../../../core/config";

/** Configuration structure in key {@link configKey} */
interface ICachingRepositoryConfig {
  /** Maximum time in seconds to keep a given key */
  ttlS: number;
  /** Maximum total number of keys */
  maxKeyCount: number;
  /** Consider logging the statistics at this period, if active will log immediately */
  printPeriodMs: number;
  /** If during a print period, this time elapsed and it is still unused, print anyway */
  printPeriodIdleMs: number;
  /**
   * Object with additional configuration for node-cache (overrides the other configuration fields here).
   * https://www.npmjs.com/package/node-cache#initialize-init
   */
  extraNodeCacheConfig?: ConstructorParameters<typeof NodeCache>[0];
}

const configKey = "database.localMemCache";
export const loadConfig = () =>
  config.has(configKey) ? (config.get(configKey) as ICachingRepositoryConfig) : undefined;

const emptyStats = () => ({ hits: 0, misses: 0, wrongIndex: 0, start: new Date() });
/**
 * This is a passthrough for {@link Repository} that caches requests by a provided
 * `keys` list of fields that must be globally unique.
 * Only {@link Repository.findOne} returns from cache.
 */
export default class CachingRepository<EntityType> extends Repository<EntityType> {
  private readonly cache;
  private cacheStats = emptyStats();

  private startPrintingStats(configuration: ICachingRepositoryConfig) {
    setInterval(() => {
      const stats = this.cacheStats;
      const ageMs = new Date().getTime() - stats.start.getTime();
      const cacheName = `CachingRepository<${this.table}>(${this.keys.join(", ")})`;
      if (stats.hits + stats.misses + stats.wrongIndex === 0) {
        if (ageMs < configuration.printPeriodIdleMs) return;
        logger.info(`${cacheName} - unused since ${ageMs / 1000}s`);
        return;
      }
      const libCacheStats = this.cache.getStats();
      this.cacheStats = emptyStats();
      logger.info(
        {
          cacheName,
          stats: {
            keyCount: libCacheStats.keys,
            valueSize: libCacheStats.vsize,
            ...stats,
          },
          ageMs,
        },
        `${cacheName} had ${stats.hits} hits and ${stats.misses} misses (${
          stats.wrongIndex
        } mismatched keys) in ${ageMs / 1000}s`,
      );
    }, configuration.printPeriodMs);
  }

  constructor(
    connector: Connector,
    table: string,
    entityType: EntityTarget<EntityType>,
    private readonly keys: string[],
  ) {
    super(connector, table, entityType);
    // Safe because RepositoryManager checks it before creating this instance
    const configuration = loadConfig()!;
    this.cache = new NodeCache({
      stdTTL: configuration.ttlS,
      maxKeys: configuration.maxKeyCount,
      ...(configuration.extraNodeCacheConfig ?? {}),
    });
    this.keys.sort();
    this.startPrintingStats(configuration);
  }

  private cacheGetEntityKey(entity: EntityType | FindFilter | undefined): string | undefined {
    if (!entity) return undefined;
    const indices = this.keys.map(k => entity[k] && encodeURIComponent(entity[k]));
    if (indices.some(x => !x)) return undefined;
    return indices.join("&");
  }

  private cacheInvalidateEntity(entity: EntityType | undefined) {
    const key = this.cacheGetEntityKey(entity);
    if (key) this.cache.del(key);
  }

  private cacheGet(keys: FindFilter): EntityType | undefined {
    const key = this.cacheGetEntityKey(keys);
    if (!key) {
      this.cacheStats.wrongIndex++;
      return undefined;
    }
    const cached = this.cache.get(key);
    if (cached) {
      this.cacheStats.hits++;
      return cached;
    }
    this.cacheStats.misses++;
    return undefined;
  }

  private cacheSave(entity: EntityType) {
    const key = entity && this.cacheGetEntityKey(entity);
    if (!key) return;
    this.cache.set(key, entity);
  }

  override async atomicCompareAndSet<FieldValueType>(
    entity: EntityType,
    fieldName: keyof EntityType,
    previousValue: FieldValueType | null,
    newValue: FieldValueType | null,
  ): Promise<AtomicCompareAndSetResult<FieldValueType>> {
    this.cacheInvalidateEntity(entity);
    return await super.atomicCompareAndSet(entity, fieldName, previousValue, newValue);
  }

  override async save(entity: EntityType, _context?: ExecutionContext): Promise<void> {
    this.cacheInvalidateEntity(entity);
    await super.save(entity, _context);
  }

  override async saveAll(entities: EntityType[] = [], _context?: ExecutionContext): Promise<void> {
    entities.forEach(entity => this.cacheInvalidateEntity(entity));
    await super.saveAll(entities, _context);
  }

  override async remove(entity: EntityType, _context?: ExecutionContext): Promise<void> {
    this.cacheInvalidateEntity(entity);
    await super.remove(entity, _context);
  }

  async findOne(
    filters: FindFilter,
    options: FindOptions = {},
    context?: ExecutionContext,
  ): Promise<EntityType> {
    const cachedValue = this.cacheGet(filters);
    if (cachedValue) return cachedValue;
    const result = (await this.find(filters, options, context)).getEntities()[0] || null;
    this.cacheSave(result);
    return result;
  }
}
