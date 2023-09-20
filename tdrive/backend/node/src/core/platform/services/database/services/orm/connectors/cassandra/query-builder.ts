import { isObject } from "lodash";
import { FindOptions } from "../../repository/repository";
import { ObjectType } from "../../types";
import { getEntityDefinition, secureOperators } from "../../utils";
import { transformValueToDbString } from "./typeTransforms";

export function buildSelectQuery<Entity>(
  entityType: ObjectType<Entity>,
  filters: Record<string, unknown>,
  findOptions: FindOptions,
  options: {
    secret?: string;
    keyspace: string;
  } = {
    secret: "",
    keyspace: "tdrive",
  },
): string {
  const instance = new (entityType as any)();
  const { columnsDefinition, entityDefinition } = getEntityDefinition(instance);
  let allowFiltering = false;

  const where = Object.keys(filters)
    .map(key => {
      let result: string;
      const filter = filters[key];

      if (!filter) {
        return;
      }
      if (isObject(filter) && JSON.stringify(filter).includes("ne")) {
        allowFiltering = true;
        result = `${key} IN (NULL, false)`;
        return result;
      }

      if (Array.isArray(filter)) {
        if (!filter.length) {
          return;
        }
        const inClause: string[] = filter.map(
          value =>
            `${transformValueToDbString(value, columnsDefinition[key].type, {
              columns: columnsDefinition[key].options,
              secret: options.secret || "",
              disableSalts: true,
            })}`,
        );

        result = `${key} IN (${inClause.join(",")})`;
      } else {
        if (key === "is_in_trash" || key === "scope") allowFiltering = true;
        result = `${key} = ${transformValueToDbString(filter, columnsDefinition[key].type, {
          columns: columnsDefinition[key].options,
          secret: options.secret || "",
          disableSalts: true,
        })}`;
      }

      return result;
    })
    .filter(Boolean);

  secureOperators(transformValueToDbString, findOptions, entityType, options);

  const whereClause = `${[
    ...where,
    ...(buildComparison(findOptions) || []),
    ...(buildIn(findOptions) || []),
    ...(buildLike(findOptions) || []),
  ].join(" AND ")}`.trimEnd();

  let orderByClause = "";
  if (findOptions.pagination?.reversed) {
    orderByClause = `${entityDefinition.options.primaryKey
      .slice(1)
      .map(
        (key: string) =>
          `${key} ${(columnsDefinition[key].options.order || "ASC") === "ASC" ? "DESC" : "ASC"}`,
      )
      .join(", ")}`;
  }

  const query = `SELECT * FROM ${options.keyspace}.${entityDefinition.name} ${
    whereClause.trim().length ? "WHERE " + whereClause : ""
  } ${orderByClause.trim().length ? "ORDER BY " + orderByClause : ""}`
    .trimEnd()
    .concat(allowFiltering ? " ALLOW FILTERING;" : ";");

  return query;
}

export function buildComparison(options: FindOptions = {}): string[] {
  let lessClause;
  let lessEqualClause;
  let greaterClause;
  let greaterEqualClause;

  if (options.$lt) {
    lessClause = options.$lt.map(element => `${element[0]} < ${element[1]}`);
  }

  if (options.$lte) {
    lessEqualClause = options.$lte.map(element => `${element[0]} <= ${element[1]}`);
  }

  if (options.$gt) {
    greaterClause = options.$gt.map(element => `${element[0]} > ${element[1]}`);
  }

  if (options.$gte) {
    greaterEqualClause = options.$gte.map(element => `${element[0]} >= ${element[1]}`);
  }

  return [
    ...(lessClause || []),
    ...(lessEqualClause || []),
    ...(greaterClause || []),
    ...(greaterEqualClause || []),
  ];
}

export function buildIn(options: FindOptions = {}): string[] {
  let inClauses: string[];
  if (options.$in) {
    inClauses = options.$in.map(element => `${element[0]} IN (${element[1].join(",")})`);
  }

  return inClauses || [];
}

export function buildLike(options: FindOptions = {}): string[] {
  let likeClauses: string[];
  if (options.$like) {
    likeClauses = options.$like.map(element => `${element[0]} LIKE '%${element[1]}%`);
  }

  return likeClauses || [];
}
