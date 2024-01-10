import { comparisonType, FindOptions } from "../../repository/repository";
import { ObjectType } from "../../types";
import { getEntityDefinition } from "../../utils";
import { PostgresDataTransformer } from "./postgres-data-transform";
import _ from "lodash";

export class PostgresQueryBuilder {
  private dataTransformer: PostgresDataTransformer;

  constructor(private secret: string) {
    this.dataTransformer = new PostgresDataTransformer({ secret: this.secret });
  }
  buildSelect<Entity>(
    entityType: ObjectType<Entity>,
    filters: Record<string, unknown>,
    options: FindOptions,
  ) {
    const instance = new (entityType as any)();
    const { columnsDefinition, entityDefinition } = getEntityDefinition(instance);

    const query = (whereClause: string, orderByClause: string, limit: number, offset: number) => {
      return `SELECT * FROM ${entityDefinition.name} 
            ${whereClause?.length ? "WHERE " + whereClause : ""} 
            ${orderByClause?.length ? "ORDER BY " + orderByClause : ""}
            LIMIT ${limit} OFFSET ${offset}`;
    };

    // === EQUAL or IN operator ===
    let idx = 1;
    const values = [];
    let whereClause = "";
    if (filters) {
      Object.keys(filters)
        .filter(key => !_.isUndefined(filters[key]))
        .forEach(key => {
          const filter = filters[key];
          if (Array.isArray(filter)) {
            if (filter.length) {
              const inClause: string[] = filter.map(
                value => `${this.dataTransformer.toDbString(value, columnsDefinition[key].type)}`,
              );

              whereClause += `${key} IN ($${inClause.map(() => idx++).join(",$")}) AND `;
              values.push(...inClause);
            }
          } else {
            const value = `${this.dataTransformer.toDbString(filter, columnsDefinition[key].type)}`;
            whereClause += `${key} = $${idx++} AND `;
            values.push(value);
          }
        });
    }

    if (options) {
      // ==== Comparison operators ===
      const appendComparison = (predicates: comparisonType[], operator: string) => {
        if (predicates) {
          predicates.forEach(element => {
            whereClause += `${element[0]} ${operator} $${idx++} AND `;
            values.push(
              this.dataTransformer.toDbString(element[1], columnsDefinition[element[0]].type),
            );
          });
        }
      };

      appendComparison(options.$lt, "<");
      appendComparison(options.$lte, "<=");
      appendComparison(options.$gt, ">");
      appendComparison(options.$gte, ">=");

      // === IN ===
      options.$in?.forEach(e => {
        whereClause += `${e[0]} IN ($${e[1].map(() => idx++).join(",$")}) AND `;
        values.push(...e[1]);
      });

      // === LIKE ====
      options.$like?.forEach(e => {
        whereClause += `${e[0]} LIKE $${idx++} AND `;
        values.push(`%${e[1]}%`);
      });
    }

    if (whereClause && whereClause.endsWith("AND ")) whereClause = whereClause.slice(0, -4);

    // ==== ORDER BY =====
    const orderByClause = `${entityDefinition.options.primaryKey
      .slice(1)
      .map(
        (key: string) =>
          `${key} ${(columnsDefinition[key].options.order || "ASC") === "ASC" ? "DESC" : "ASC"}`,
      )}`;

    // ==== PAGING =====
    let limit = 100;
    let offset = 0;
    if (options?.pagination) {
      if (options.pagination.limitStr) {
        limit = Number.parseInt(options.pagination.limitStr);
      }
      if (options.pagination.page_token) {
        offset = (Number.parseInt(options.pagination.page_token) - 1) * limit;
      }
    }

    return [query(whereClause, orderByClause, limit, offset), values];
  }
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
