export type EntityDefinition = {
  name: string;
  type: string;
  options: {
    primaryKey: (string | string[])[];
    globalIndexes?: string[][];
    ttl?: number;
    search?: {
      source: <Entity>(entity: Entity) => any; //Should return an object that will be indexed
      shouldUpdate?: (entity: any) => any; //Should return an object that will be indexed
      index?: string; //Index name
      esMapping?: any; //Used for elasticsearch / mongodb mappings
      mongoMapping?: any; //Used for elasticsearch / mongodb mappings
    };
  };
};

export type ColumnDefinition = {
  type: ColumnType;
  nodename: string;
  options: ColumnOptions;
};

export type ColumnOptions = {
  order?: "ASC" | "DESC";
  generator?: ColumnType;
  onUpsert?: (value: any) => any;
  rename?: string;
};

export type ColumnType =
  | "encoded_string"
  | "encoded_json"
  | "string"
  | "json"
  | "number"
  | "timeuuid"
  | "uuid"
  | "counter"
  | "blob"
  | "boolean"
  // backward compatibility
  | "tdrive_boolean"
  | "tdrive_int"
  | "tdrive_datetime";

export type EntityTarget<Entity> = ObjectType<Entity>;

// eslint-disable-next-line @typescript-eslint/ban-types
export type ObjectType<T> = { new (): T };

/** Local Event bus */

export type DatabaseEntitiesSavedEvent = {
  entities: any[];
};

export type DatabaseEntitiesRemovedEvent = {
  entities: any[];
};
