/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types */
import { TdriveServiceProvider } from "../../framework";
import { ListResult } from "../../framework/api/crud-service";
import {
  FindFilter as OrmFindFilter,
  FindOptions as OrmFindOptions,
} from "../database/services/orm/repository/repository";
import { EntityTarget } from "../database/services/orm/types";
import SearchRepository from "./repository";

export { getEntityDefinition, unwrapPrimarykey } from "../database/services/orm/utils";
export {
  DatabaseEntitiesRemovedEvent,
  DatabaseEntitiesSavedEvent,
  EntityDefinition,
  ColumnDefinition,
  EntityTarget,
} from "../database/services/orm/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FindFilter = OrmFindFilter;

type TextType = {
  $search: string;
  $caseSensitive?: boolean; //Default false
  $diacriticSensitive?: boolean; //Default false
};

export type SortType = {
  [key: string]: "asc" | "desc";
};

//Field, regex, options
type RegexType = [string, string, string];

export type FindOptions = OrmFindOptions & {
  $regex?: RegexType[];
  $text?: TextType;
  $sort?: SortType;
};

export type IndexedEntity = {
  primaryKey: { [key: string]: any };
  score: number;
};

export interface SearchAdapterInterface {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  upsert(entities: any[]): Promise<void>;
  remove(entities: any[]): Promise<void>;

  search<Entity>(
    table: string,
    entityType: EntityTarget<Entity>,
    filters: FindFilter,
    options: FindOptions,
  ): Promise<ListResult<IndexedEntity>>;
}

export interface SearchServiceAPI extends TdriveServiceProvider {
  getRepository<Entity>(table: string, entityType: EntityTarget<Entity>): SearchRepository<Entity>;
  upsert(entities: any[]): Promise<void>;
  remove(entities: any[]): Promise<void>;
  type: SearchConfiguration["type"];
}

export type SearchConfiguration = {
  type?: false | "elasticsearch" | "mongodb" | "opensearch";
  elasticsearch?: ESSearchConfiguration;
  opensearch?: ESSearchConfiguration;
};

export type ESSearchConfiguration = {
  useAuth: boolean;
  username?: string;
  password?: string;
  endpoint: string;
  flushInterval: number; //In milliseconds
};
