import { comparisonType, FindOptions } from "../../repository/repository";
import { ColumnDefinition, ObjectType } from "../../types";
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
            const isANotEqualFilter = filter && Object.keys(filter).join("!") === "$ne";
            if (filter === null || (isANotEqualFilter && filter["$ne"] === null)) {
              whereClause += `${key} IS${filter === null ? "" : " NOT"} NULL`;
            } else {
              const filterValue = isANotEqualFilter ? filter["$ne"] : filter;
              const value = `${this.dataTransformer.toDbString(
                filterValue,
                columnsDefinition[key].type,
              )}`;
              whereClause += `${key} ${isANotEqualFilter ? "!=" : "="} $${idx++} AND `;
              values.push(value);
            }
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
    let orderByClause = `${entityDefinition.options.primaryKey
      .slice(1)
      .map(
        (key: string) =>
          `${key} ${(columnsDefinition[key].options.order || "ASC") === "ASC" ? "DESC" : "ASC"}`,
      )}`;

    // ==== ORDER BY CUSTOM COLUMN =====
    if (options?.sort) {
      orderByClause = Object.keys(options.sort)
        .map(key => `${key} ${options.sort[key].toUpperCase()}`)
        .join(", ");
    }

    // ==== PAGING =====
    let limit = 100;
    let offset = 0;
    if (options?.pagination) {
      if (options.pagination.limitStr) {
        limit = Number.parseInt(options.pagination.limitStr);
      }
      if (options.pagination.page_token) {
        offset = Number.parseInt(options.pagination.page_token) * limit;
      }
    }
    return [query(whereClause, orderByClause, limit, offset), values];
  }

  private toValueKeyDBStringPairFromValue(
    columnsDefinition: { [key: string]: ColumnDefinition },
    key: string,
    value: any,
  ): [string, any] {
    return [key, this.dataTransformer.toDbString(value, columnsDefinition[key].type)];
  }

  private toValueKeyDBStringPairFromEntity<Entity>(
    entity: Entity,
    columnsDefinition: { [key: string]: ColumnDefinition },
    key: string,
  ) {
    return this.toValueKeyDBStringPairFromValue(
      columnsDefinition,
      key,
      entity[columnsDefinition[key].nodename],
    );
  }

  buildDelete<Entity>(entity: Entity): Query {
    const { columnsDefinition, entityDefinition } = getEntityDefinition(entity);
    const primaryKey = unwrapPrimarykey(entityDefinition);

    const where = primaryKey.map(key =>
      this.toValueKeyDBStringPairFromEntity(entity, columnsDefinition, key),
    );
    const query = `DELETE FROM "${entityDefinition.name}"
                WHERE ${where.map((e, idx) => `${e[0]} = $${idx + 1}`).join(" AND ")}`;

    return [query, where.map(f => f[1])];
  }

  buildInsert<Entity>(entity: Entity): Query {
    const { columnsDefinition, entityDefinition } = getEntityDefinition(entity);

    const fields = Object.keys(columnsDefinition)
      .filter(key => entity[columnsDefinition[key].nodename] !== undefined)
      .map(key => this.toValueKeyDBStringPairFromEntity(entity, columnsDefinition, key));
    const query = `INSERT INTO "${entityDefinition.name}" (${fields.map(e => e[0]).join(", ")})
              VALUES (${fields.map((e, idx) => `$${idx + 1}`).join(", ")})`;
    return [query, fields.map(f => f[1])];
  }

  private buildWhereClause(startIndex: number, where: [string, any[]][]): Query {
    const equalsOrIs = ([key, value]) =>
      [key, value === null ? "IS" : "=", value === null ? "NULL" : `$${startIndex++}`].join(" ");
    return [
      `WHERE ${where.map(equalsOrIs).join(" AND ")} `,
      where.filter(f => f[1] !== null).map(f => f[1]),
    ];
  }

  private buildUpdateQueryString(
    tableName: string,
    set: [string, any][],
    where: [string, any][],
    returning?: string,
  ): Query {
    // if (!set || set.length == 0)
    //   throw new Error(`Cannot build UPDATE query with empty SET on ${tableName} with WHERE: ${where}`);
    const [whereClause, whereParameters] = this.buildWhereClause(set.length + 1, where);
    const query = `UPDATE "${tableName}" 
              SET ${set.map((e, idx) => `${e[0]} = $${idx + 1}`).join(", ")} 
              ${whereClause} 
              ${returning ? "RETURNING " + returning : ""} `;
    const values = [];
    values.push(...set.map(f => f[1]));
    values.push(...whereParameters);
    return [query, values];
  }

  buildUpdate<Entity>(entity: Entity): Query {
    const { columnsDefinition, entityDefinition } = getEntityDefinition(entity);
    const primaryKey = unwrapPrimarykey(entityDefinition);

    // Set updated content
    const set = Object.keys(columnsDefinition)
      .filter(key => primaryKey.indexOf(key) === -1)
      .filter(key => entity[columnsDefinition[key].nodename] !== undefined)
      .map(key => this.toValueKeyDBStringPairFromEntity(entity, columnsDefinition, key));
    //Set primary key
    const where = primaryKey.map(key =>
      this.toValueKeyDBStringPairFromEntity(entity, columnsDefinition, key),
    );
    return this.buildUpdateQueryString(entityDefinition.name, set, where);
  }

  buildatomicCompareAndSet<Entity, FieldValueType>(
    entity: Entity,
    fieldName: keyof Entity,
    previousValue: FieldValueType,
    newValue: FieldValueType,
  ) {
    const { columnsDefinition, entityDefinition } = getEntityDefinition(entity);
    const primaryKey = unwrapPrimarykey(entityDefinition);
    const columnName = (Object.entries(columnsDefinition).filter(
      ([, { nodename }]) => nodename === fieldName,
    )[0] ?? [])[0];
    if (!columnName)
      throw new Error(
        `Can't find field ${JSON.stringify(fieldName)} in ${JSON.stringify(columnsDefinition)}`,
      );
    const where = primaryKey.map(key =>
      this.toValueKeyDBStringPairFromEntity(entity, columnsDefinition, key),
    );
    const whereQueryWithoutField = this.buildWhereClause(0 + 1, where);
    where.push(
      this.toValueKeyDBStringPairFromValue(columnsDefinition, columnName as string, previousValue),
    );
    return {
      updateQuery: this.buildUpdateQueryString(
        entityDefinition.name,
        [this.toValueKeyDBStringPairFromValue(columnsDefinition, columnName as string, newValue)],
        where,
      ),
      getValueQuery: [
        `SELECT "${columnName}" FROM "${entityDefinition.name}" ${whereQueryWithoutField[0]}`,
        whereQueryWithoutField[1],
      ] as Query,
    };
  }
}
