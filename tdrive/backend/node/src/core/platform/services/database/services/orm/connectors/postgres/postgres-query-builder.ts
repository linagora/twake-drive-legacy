import { comparisonType, FindOptions } from "../../repository/repository";
import { ObjectType } from "../../types";
import { getEntityDefinition, unwrapPrimarykey } from "../../utils";
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

  buildDelete<Entity>(entity: Entity) {
    const { columnsDefinition, entityDefinition } = getEntityDefinition(entity);
    const primaryKey = unwrapPrimarykey(entityDefinition);

    const toValueKeyDBStringPair = (key: string) => {
      return [
        key,
        this.dataTransformer.toDbString(
          entity[columnsDefinition[key].nodename],
          columnsDefinition[key].type,
        ),
      ];
    };

    const where = primaryKey.map(key => toValueKeyDBStringPair(key));
    const query = `DELETE FROM ${entityDefinition.name} 
                WHERE ${where.map((e, idx) => `${e[0]} = $${idx + 1}`).join(" AND ")}`;

    return [query, where.map(f => f[1])];
  }
}
