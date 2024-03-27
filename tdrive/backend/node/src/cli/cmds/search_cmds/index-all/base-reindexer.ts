import type { DatabaseServiceAPI } from "../../../../core/platform/services/database/api";
import type { TdrivePlatform } from "../../../../core/platform/platform";
import type Repository from "../../../../core/platform/services/database/services/orm/repository/repository";
import type SearchRepository from "../../../../core/platform/services/search/repository";
import type {
  EntityTarget,
  FindOptions,
  SearchServiceAPI,
} from "../../../../core/platform/services/search/api";

import waitTimeoutMS from "../../../utils/wait-timeout";
import iterateOverRepoPages from "../../../utils/iterate-over-repository-pages";
import type ReindexerOptions from "./reindexer-options";

const pluralificationate = (noun: string) => noun.replace(/s$/i, "").replace(/y$/i, "ie") + "s";

/** This is an abstract base class for re-index cli commands; it stores runtime options
 *  into fields; runs repair first if requested and re-indexes generically from the database
 *  to search services. */
export default abstract class BaseReindexer<Entity> {
  protected readonly database: DatabaseServiceAPI;
  protected readonly search: SearchServiceAPI;
  private readonly tablePlural: string;

  constructor(
    protected readonly platform: TdrivePlatform,
    protected readonly options: ReindexerOptions,
    private readonly table: string,
    private readonly entity: EntityTarget<Entity>,
  ) {
    this.database = this.platform.getProvider<DatabaseServiceAPI>("database");
    this.search = this.platform.getProvider<SearchServiceAPI>("search");
    this.tablePlural = pluralificationate(this.table);
  }

  private _dbRepo: Repository<Entity>;
  protected async dbRepository() {
    return (this._dbRepo =
      this._dbRepo || (await this.database.getRepository<Entity>(this.table, this.entity)));
  }

  private _searchRepo: SearchRepository<Entity>;
  protected async searchRepository() {
    return (this._searchRepo =
      this._searchRepo || this.search.getRepository<Entity>(this.table, this.entity));
  }

  protected statusStart(info: string) {
    this.options.spinner.start(`${this.tablePlural} > ${info}`);
  }
  protected statusSucceed(info: string) {
    this.options.spinner.succeed(`${this.tablePlural} > ${info}`);
  }
  protected statusWarn(info: string) {
    this.options.spinner.warn(`${this.tablePlural} > ${info}`);
  }
  protected statusFail(info: string) {
    this.options.spinner.fail(`${this.tablePlural} > ${info}`);
  }
  protected statusInfo(info: string) {
    this.options.spinner.info(`${this.tablePlural} > ${info}`);
  }

  /** Override in sub-classes to translate a page from database to search entities.
   * This is called by `reindexFromDBToSearch` so if that is overriden; this won't be called.
   */
  protected async mapEntitiesToReIndexFromDBToSearch(entities: Entity[]): Promise<Entity[]> {
    return entities;
  }

  /** Override in sub-classes that have filters (eg. from arguments) for the entities to re-index/repair */
  protected async prepareFindOptionsForItemsToReIndex(): Promise<FindOptions | undefined> {
    return undefined;
  }

  /** Override in sub-classes that handle the --repairEntities argument.
   * It is executed before reindexFromDBToSearch. What repair means depends
   * on the entity type.
   */
  protected async repairEntities(_findOptions: FindOptions): Promise<void> {
    this.statusWarn(`repairEntities > No repair action for ${this.tablePlural}`);
  }

  /** Override in a sub-class to completely replace the re-indexing logic.
   * - Iterates over pages of the entity from the database repository
   *     - calls `mapEntitiesToReIndexFromDBToSearch` to convert each page to a search entity
   *     - and upserts the result into the search repository
   */
  protected async reindexFromDBToSearch(findOptions: FindOptions): Promise<void> {
    const repository = await this.dbRepository();
    this.statusStart("Start indexing...");
    let count = 0;
    await iterateOverRepoPages(
      repository,
      async entities => {
        entities = await this.mapEntitiesToReIndexFromDBToSearch(entities);
        await this.search.upsert(entities);
        count += entities.length;
        this.statusStart(`Indexed ${count} ${this.tablePlural}...`);
      },
      findOptions,
    );
    if (count === 0) this.statusWarn(`Index ${this.tablePlural} finished; but 0 items included`);
    else this.statusSucceed(`${count} ${this.tablePlural} indexed`);
    const giveFlushAChanceDurationMS = 10000;
    this.statusStart(`Emptying flush (${giveFlushAChanceDurationMS / 1000}s)...`);
    await waitTimeoutMS(giveFlushAChanceDurationMS);
    this.statusSucceed("Done!");
  }

  /** Run both operations: repair if requested and re-index */
  public async run(): Promise<void> {
    const findOptions = await this.prepareFindOptionsForItemsToReIndex();
    if (this.options.repairEntities) await this.repairEntities(findOptions);
    await this.reindexFromDBToSearch(findOptions);
  }
}
