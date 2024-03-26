/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types */
import { Connector, UpsertOptions } from ".";
import { ConnectionOptions, DatabaseType } from "../..";
import { FindOptions } from "../repository/repository";
import { ColumnDefinition, EntityDefinition } from "../types";
import { ListResult } from "../../../../../framework/api/crud-service";

export abstract class AbstractConnector<T extends ConnectionOptions> implements Connector {
  constructor(protected type: DatabaseType, protected options: T, protected secret: string) {}

  abstract connect(): Promise<this>;
  abstract disconnect(): Promise<this>;

  abstract drop(): Promise<this>;

  abstract createTable(
    entity: EntityDefinition,
    columns: { [name: string]: ColumnDefinition },
  ): Promise<boolean>;

  abstract upsert(entities: any[], _options: UpsertOptions): Promise<boolean[]>;

  abstract remove(entities: any[]): Promise<boolean[]>;

  abstract find<EntityType>(
    entityType: any,
    filters: any,
    options: FindOptions,
  ): Promise<ListResult<EntityType>>;

  getOptions(): T {
    return this.options;
  }

  getType(): DatabaseType {
    return this.type;
  }
}
