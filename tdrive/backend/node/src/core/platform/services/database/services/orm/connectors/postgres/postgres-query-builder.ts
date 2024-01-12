import { comparisonType, FindOptions } from "../../repository/repository";
import { ObjectType } from "../../types";
import { getEntityDefinition, unwrapPrimarykey } from "../../utils";
import { PostgresDataTransformer } from "./postgres-data-transform";
import _ from "lodash";

export type Query = [string, any[]];

export class PostgresQueryBuilder {
  private dataTransformer: PostgresDataTransformer;

  constructor(private secret: string) {
    this.dataTransformer = new PostgresDataTransformer({ secret: this.secret });
  }

  buildSelect<Entity>(
    entityType: ObjectType<Entity>,
    filters: Record<string, unknown>,
    options: FindOptions,
  ): Query {
    const instance = new (entityType as any)();
    const { columnsDefinition, entityDefinition } = getEntityDefinition(instance);

    const query = (whereClause: string, orderByClause: string, limit: number, offset: number) => {
      return `SELECT * FROM "${entityDefinition.name}" 
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

  buildDelete<Entity>(entity: Entity): Query {
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
    const query = `DELETE FROM "${entityDefinition.name}" 
                WHERE ${where.map((e, idx) => `${e[0]} = $${idx + 1}`).join(" AND ")}`;

    return [query, where.map(f => f[1])];
  }

  buildInsert<Entity>(entity: Entity): Query {
    const { columnsDefinition, entityDefinition } = getEntityDefinition(entity);
    const toValueKeyDBStringPair = (key: string) => {
      return [
        key,
        this.dataTransformer.toDbString(
          entity[columnsDefinition[key].nodename],
          columnsDefinition[key].type,
        ),
      ];
    };

    const fields = Object.keys(columnsDefinition)
      .filter(key => entity[columnsDefinition[key].nodename] !== undefined)
      .map(key => toValueKeyDBStringPair(key));
    const query = `INSERT INTO "${entityDefinition.name}" (${fields.map(e => e[0]).join(", ")}) 
              VALUES (${fields.map((e, idx) => `$${idx + 1}`).join(", ")})`;
    return [query, fields.map(f => f[1])];
  }

  buildUpdate<Entity>(entity: Entity): Query {
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

    // Set updated content
    const set = Object.keys(columnsDefinition)
      .filter(key => primaryKey.indexOf(key) === -1)
      .filter(key => entity[columnsDefinition[key].nodename] !== undefined)
      .map(key => toValueKeyDBStringPair(key));
    //Set primary key
    const where = primaryKey.map(key => toValueKeyDBStringPair(key));
    //Start index for where clause params
    const whereIdx = set.length + 1;
    const query = `UPDATE "${entityDefinition.name}" 
              SET ${set.map((e, idx) => `${e[0]} = $${idx + 1}`).join(", ")} 
              WHERE ${where.map((e, idx) => `${e[0]} = $${whereIdx + idx}`).join(" AND ")}`;
    const values = [];
    values.push(...set.map(f => f[1]));
    values.push(...where.map(f => f[1]));

    return [query, values];
  }
}
