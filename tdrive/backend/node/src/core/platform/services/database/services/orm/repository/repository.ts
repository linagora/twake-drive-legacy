import { assign } from "lodash";
import { logger } from "../../../../../../../core/platform/framework";
import {
  ExecutionContext,
  ListResult,
  Pagination,
} from "../../../../../framework/api/crud-service";
import { Connector } from "../connectors";
import Manager from "../manager";
import { EntityTarget } from "../types";
import { getEntityDefinition } from "../utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FindFilter = { [key: string]: any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RemoveFilter = { [key: string]: any };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type comparisonType = [string, any];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type inType = [string, Array<any>];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type likeType = [string, any];

type SortDirection = "asc" | "desc";

type SortOption = {
  [field: string]: SortDirection;
};

export type FindOptions = {
  pagination?: Pagination;
  $lt?: comparisonType[];
  $lte?: comparisonType[];
  $gt?: comparisonType[];
  $gte?: comparisonType[];
  /**
   * The $in operator selects the documents where the value of a field equals any value in the specified array
   */
  $in?: inType[];
  $nin?: inType[];
  $like?: likeType[];
  sort?: SortOption;
};

export type AtomicCompareAndSetResult<FieldValueType> = {
  didSet: boolean;
  currentValue: FieldValueType | null;
};

/**
 * Repository to work with entities. Each entity type has its own repository instance.
 */
export default class Repository<EntityType> {
  manager: Manager<EntityType>;

  constructor(
    readonly connector: Connector,
    readonly table: string,
    readonly entityType: EntityTarget<EntityType>,
  ) {
    this.manager = new Manager<EntityType>(this.connector);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  checkEntityDefinition(): boolean {
    //TODO, check entity definition make sense from this.entityType
    return true;
  }

  async init(): Promise<this> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instance = new (this.entityType as any)() as EntityType;

    if (this.checkEntityDefinition()) {
      const { columnsDefinition, entityDefinition } = getEntityDefinition(instance);
      await this.connector.createTable(entityDefinition, columnsDefinition);
    }

    return this;
  }

  async find(
    filters: FindFilter,
    options: FindOptions = {},
    _context?: ExecutionContext,
  ): Promise<ListResult<EntityType>> {
    if (!this.entityType) {
      throw Error(`Unable to find or findOne: EntityType ${this.table} not initialized`);
    }

    if (!options.pagination) {
      options.pagination = new Pagination("", "1000");
    }

    return await this.connector.find(this.entityType, filters, options);
  }

  async findOne(
    filters: FindFilter,
    options: FindOptions = {},
    context?: ExecutionContext,
  ): Promise<EntityType> {
    if (!options.pagination) {
      options.pagination = new Pagination("", "1");
    }

    return (await this.find(filters, options, context)).getEntities()[0] || null;
  }

  /**
   * Updates an entity's field `fieldName` to `newValue`, only if its
   * current value in the DB is `previousValue`. Does so atomically
   * (for whatever that means for the specific DB type - mostly a
   * single query, with no special write concern etc.).
   *
   * Note that the `currentValue` returned may not be atomic depending
   * on the DB type.
   *
   * Unlike the identical on the `Connector`, the manager is flushed
   * and reset before the operation is ran.
   *
   * A single entity for that primary key must already exist. This is not
   * always tested, and a return without error should not be interpreted as
   * such a row existing.
   *
   * @param entity Entity to try to update
   * @param fieldName Name of the field to compare and possibly set (the node.js field name)
   * @param previousValue Value of that field expected in the DB
   * @param newValue New value to assign if the existing value matches `previousValue`
   */
  async atomicCompareAndSet<FieldValueType>(
    entity: EntityType,
    fieldName: keyof EntityType,
    previousValue: FieldValueType | null,
    newValue: FieldValueType | null,
  ): Promise<AtomicCompareAndSetResult<FieldValueType>> {
    if (previousValue === newValue)
      throw new Error(`Previous and new values are identical: ${JSON.stringify(previousValue)}`);
    return this.connector.atomicCompareAndSet(entity, fieldName, previousValue, newValue);
  }

  async save(entity: EntityType, _context?: ExecutionContext): Promise<void> {
    await this.manager.persist(entity);
  }

  async saveAll(entities: EntityType[] = [], _context?: ExecutionContext): Promise<void> {
    logger.debug("services.database.repository - Saving entities");
    await Promise.all(entities.map(entity => this.manager.persist(entity)));
  }

  async remove(entity: EntityType, _context?: ExecutionContext): Promise<boolean> {
    return this.manager.remove(entity);
  }

  //Avoid using this except when no choice
  createEntityFromObject(object: any): EntityType {
    const entity = new (this.entityType as any)() as EntityType;
    return assign(entity, object);
  }
}
