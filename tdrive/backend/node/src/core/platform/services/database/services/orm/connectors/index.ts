import { Initializable } from "../../../../../framework";
import { DatabaseType } from "../..";
import { MongoConnectionOptions } from "./mongodb/mongodb";
import { ColumnDefinition, EntityDefinition } from "../types";
import { FindOptions } from "../repository/repository";
import { ListResult } from "../../../../../framework/api/crud-service";
import { PostgresConnectionOptions } from "./postgres/postgres";

export * from "./mongodb/mongodb";

export type UpsertOptions = {
  action?: "INSERT" | "UPDATE";
};

export type RemoveOptions = any;

export interface Connector extends Initializable {
  /**
   * Connect to the database
   */
  connect(): Promise<this>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<this>;

  /**
   * Get the type of connector
   */
  getType(): DatabaseType;

  /**
   * Drop data
   */
  drop(): Promise<this>;

  /**
   * Create table
   */
  createTable(
    entity: EntityDefinition,
    columns: { [name: string]: ColumnDefinition },
  ): Promise<boolean>;

  /**
   * Upsert
   * returns true if the object was created/updated, false otherwise
   */
  upsert(entities: any[], _options: UpsertOptions): Promise<boolean[]>;

  /**
   * Updates an entity's field `fieldName` to `newValue`, only if its
   * current value in the DB is `previousValue`. Does so atomically
   * (for whatever that means for the specific DB type - mostly a
   * single query, with no special write concern etc.).
   *
   * Note that the `currentValue` returned may not be atomic depending
   * on the DB type.
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
  atomicCompareAndSet<Entity, FieldValueType>(
    entity: Entity,
    fieldName: keyof Entity,
    previousValue: FieldValueType | null,
    newValue: FieldValueType | null,
  ): Promise<{
    didSet: boolean;
    currentValue: FieldValueType | null;
  }>;

  /**
   * Remove
   * returns true if the object was removed, false otherwise
   */
  remove(entities: any[]): Promise<boolean[]>;

  /**
   * Find items in database
   * returns the list of entities matching the filters and options.
   */
  find<EntityType>(
    entityType: any,
    filters: any,
    options: FindOptions,
  ): Promise<ListResult<EntityType>>;
}

export declare type ConnectionOptions = MongoConnectionOptions | PostgresConnectionOptions;
