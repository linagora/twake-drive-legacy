import _, { flatten } from "lodash";
import { FindOptions } from "./repository/repository";
import { ColumnDefinition, EntityDefinition, ObjectType } from "./types";

export function getEntityDefinition(instance: any): {
  entityDefinition: EntityDefinition;
  columnsDefinition: { [name: string]: ColumnDefinition };
} {
  const entityConfiguration = _.cloneDeep(instance.constructor.prototype._entity);
  const entityColumns = _.cloneDeep(instance.constructor.prototype._columns);
  return {
    entityDefinition: entityConfiguration,
    columnsDefinition: entityColumns,
  };
}

export function unwrapPrimarykey(entityDefinition: EntityDefinition): string[] {
  const initial = [...entityDefinition.options.primaryKey];
  const partitionKey = initial.shift();
  return [
    ...(typeof partitionKey === "string" ? [partitionKey] : partitionKey),
    ...(initial as string[]),
  ];
}

export function unwrapIndexes(entityDefinition: EntityDefinition): string[] {
  const indexes = entityDefinition.options.globalIndexes;
  if (!indexes) return [];

  return flatten(entityDefinition.options.globalIndexes);
}

export function secureOperators<Entity>(
  // eslint-disable-next-line @typescript-eslint/ban-types
  transformValueToDbString: Function,
  findOptions: FindOptions = {},
  entityType: ObjectType<Entity>,
  options: {
    secret?: string;
    keyspace: string;
  } = {
    secret: "",
    keyspace: "tdrive",
  },
): FindOptions {
  const instance = new (entityType as any)();
  const { columnsDefinition } = getEntityDefinition(instance);

  Object.keys(findOptions).forEach(key => {
    if (
      key == "$in" ||
      key == "$lte" ||
      key == "$lt" ||
      key == "$gte" ||
      key == "$gt" ||
      key == "$like"
    ) {
      findOptions[key].forEach(element => {
        if (columnsDefinition[element[0]]) {
          if (_.isArray(element[1])) {
            element[1] = element[1].map((e: any) =>
              transformValueToDbString(e, columnsDefinition[element[0]].type, {
                columns: columnsDefinition[element[0]].options,
                secret: options.secret || "",
              }),
            );
          } else {
            element[1] = transformValueToDbString(element[1], columnsDefinition[element[0]].type, {
              columns: columnsDefinition[element[0]].options,
              secret: options.secret || "",
            });
          }
        }
      });
    }
  });

  return findOptions;
}

/**
 * Build uuid from nanotime
 * @param orderable
 * @returns
 */
export function fromMongoDbOrderable(orderable: string): string {
  if (!orderable) {
    return null;
  }
  const uuid_arr = orderable.split("-");
  return [uuid_arr[2], uuid_arr[1], uuid_arr[0], uuid_arr[3], uuid_arr[4]].join("-");
}

/**
 * Returns orderable string
 * @param timeuuid
 * @returns
 */
export function toMongoDbOrderable(timeuuid?: string): string {
  if (!timeuuid) {
    return null;
  }
  const uuid_arr = timeuuid.split("-");
  return [uuid_arr[2], uuid_arr[1], uuid_arr[0], uuid_arr[3], uuid_arr[4]].join("-");
}

/**
 * Check if filtering is necessary
 * @param {string} key
 * @returns {boolean} Returns true if key is "is_in_trash", "scope" or "sub", otherwise returns false.
 */
export const filteringRequired = (key: string) => {
  return key === "is_in_trash" || key === "scope" || key === "sub";
};
