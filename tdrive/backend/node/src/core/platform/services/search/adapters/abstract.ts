/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-unused-vars */
import { ListResult } from "../../../framework/api/crud-service";
import { FindFilter } from "../../database/services/orm/repository/repository";
import {
  ColumnDefinition,
  EntityDefinition,
  EntityTarget,
  FindOptions,
  IndexedEntity,
  SearchAdapterInterface,
} from "../api";

type indexColumns = { [name: string]: ColumnDefinition };

export class SearchAdapter implements SearchAdapterInterface {
  private createdIndexes: string[] = [];

  protected async ensureIndex(
    entityDefinition: EntityDefinition,
    columns: indexColumns,
    createIndex: (arg0: EntityDefinition, arg1: indexColumns) => any,
  ) {
    const index = entityDefinition.name;
    if (!this.createdIndexes.includes(index)) {
      this.createdIndexes.push(index);
      await createIndex(entityDefinition, columns);
    }
  }

  connect(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  disconnect(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  upsert(entities: any[]): Promise<void> {
    throw new Error("Method not implemented.");
  }
  remove(entities: any[]): Promise<void> {
    throw new Error("Method not implemented.");
  }
  search<Entity>(
    table: string,
    entityType: EntityTarget<Entity>,
    filters: FindFilter,
    options: FindOptions,
  ): Promise<ListResult<IndexedEntity>> {
    throw new Error("Method not implemented.");
  }
}
