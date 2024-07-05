import {
  PostgresQueryBuilder
} from "../../../../../../../../../src/core/platform/services/database/services/orm/connectors/postgres/postgres-query-builder";
import { expect, jest } from "@jest/globals";
import { randomInt, randomUUID } from "crypto";
import { newTestDbEntity, normalizeWhitespace, TestDbEntity } from "./utils";
import {
  comparisonType
} from "../../../../../../../../../src/core/platform/services/database/services/orm/repository/repository";

type SortDirection = "asc" | "desc";

type SortOption = {
  [field: string]: SortDirection;
};

interface FindOptions {
  sort?: SortOption;
  pagination?: {
    limitStr: string;
    page_token: string;
  };
}

describe('The PostgresQueryBuilder', () => {

  const subj: PostgresQueryBuilder = new PostgresQueryBuilder("");

  beforeEach(async () => {
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('buildSelect query with filter', async () => {
    //given
    const filter = new TestDbEntity({id: randomUUID(), company_id: randomUUID() })

    //when
    const query = subj.buildSelect(TestDbEntity, filter as { [key: string]: any }, null);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe(`SELECT * FROM "test_table" WHERE company_id = $1 AND id = $2 ORDER BY id DESC LIMIT 100 OFFSET 0`);
    expect(query[1]).toEqual([filter.company_id, filter.id]);
  });

  test('buildSelect query with array in filters', async () => {
    //given
    const filter = {id: randomUUID(), company_id: [randomUUID(), randomUUID()] };

    //when
    const query = subj.buildSelect(TestDbEntity, filter as { [key: string]: any }, null);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe(`SELECT * FROM "test_table" WHERE id = $1 AND company_id IN ($2,$3) ORDER BY id DESC LIMIT 100 OFFSET 0`);
    expect(query[1]).toEqual([filter.id, filter.company_id[0], filter.company_id[1]]);
  });

  test('buildSelect query "lt" options', async () => {
    //given
    const options = { $lt: [["added", randomInt(10)] as comparisonType, ["added", randomInt(10)] as comparisonType]};

    //when
    const query = subj.buildSelect(TestDbEntity, null, options);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe(`SELECT * FROM "test_table" WHERE added < $1 AND added < $2 ORDER BY id DESC LIMIT 100 OFFSET 0`);
    expect(query[1]).toEqual(options.$lt.map(e=> e[1]));
  });

  test('buildSelect query "gt" options', async () => {
    //given
    const options = { $gt: [["added", randomInt(10)] as comparisonType, ["added", randomInt(10)] as comparisonType]};

    //when
    const query = subj.buildSelect(TestDbEntity, null, options);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe(`SELECT * FROM "test_table" WHERE added > $1 AND added > $2 ORDER BY id DESC LIMIT 100 OFFSET 0`);
    expect(query[1]).toEqual(options.$gt.map(e=> e[1]));
  });

  test('buildSelect query "in" options', async () => {
    //given
    const options = { $in: [["added", [randomInt(10), randomInt(10)]] as comparisonType,]};

    //when
    const query = subj.buildSelect(TestDbEntity, null, options);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe(`SELECT * FROM "test_table" WHERE added IN ($1,$2) ORDER BY id DESC LIMIT 100 OFFSET 0`);
    expect(query[1]).toEqual(options.$in[0][1]);
  });

  test('buildSelect query "like" options', async () => {
    //given
    const options = { $like: [["id", randomUUID()] as comparisonType, ["company_id", randomUUID()] as comparisonType]};

    //when
    const query = subj.buildSelect(TestDbEntity, null, options);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe(`SELECT * FROM "test_table" WHERE id LIKE $1 AND company_id LIKE $2 ORDER BY id DESC LIMIT 100 OFFSET 0`);
    expect(query[1]).toEqual(options.$like.map(e=> `%${e[1]}%`));
  });

  test('buildDelete query', async () => {
    //given
    const entity = newTestDbEntity();

    //when
    const query = subj.buildDelete(entity);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe(`DELETE FROM "test_table" WHERE company_id = $1 AND id = $2`);
    expect(query[1]).toEqual([entity.company_id, entity.id]);
  });

  test('buildSelect query with sort option', async () => {
    //given
    const options = { sort: { added: "asc", id: "desc" } };

    //when
    const query = subj.buildSelect(TestDbEntity, null, options);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe(`SELECT * FROM "test_table" ORDER BY added ASC, id DESC LIMIT 100 OFFSET 0`);
    expect(query[1]).toEqual([]);
  });

  test('buildSelect query with pagination', async () => {
    //given
    const options = { pagination: { limitStr: "50", page_token: "2" } };

    //when
    const query = subj.buildSelect(TestDbEntity, null, options);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe(`SELECT * FROM "test_table" ORDER BY id DESC LIMIT 50 OFFSET 50`);
    expect(query[1]).toEqual([]);
  });

  test('buildSelect query with filter, sort, and pagination', async () => {
    //given
    const filter = { id: randomUUID(), company_id: randomUUID() };
    const options = { sort: { added: "asc" as SortDirection, id: "desc" as SortDirection }, pagination: { limitStr: "10", page_token: "3" } };

    //when
    const query = subj.buildSelect(TestDbEntity, filter as { [key: string]: any }, options);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe(`SELECT * FROM "test_table" WHERE id = $1 AND company_id = $2 ORDER BY added ASC, id DESC LIMIT 10 OFFSET 20`);
    expect(query[1]).toEqual([filter.id, filter.company_id]);
  });

  test('buildInsert', async () => {
    //given
    const entity = newTestDbEntity();

    //when
    const query = subj.buildInsert(entity);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe(`INSERT INTO "test_table" (company_id, id, parent_id, is_in_trash, tags, added) VALUES ($1, $2, $3, $4, $5, $6)`);
    assertInsertQueryParams(entity, query[1] as any[])
  });

  test('buildUpdate', async () => {
    //given
    const entity = newTestDbEntity();

    //when
    const query = subj.buildUpdate(entity);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe(`UPDATE "test_table" SET parent_id = $1, is_in_trash = $2, tags = $3, added = $4 WHERE company_id = $5 AND id = $6`);
    assertUpdateQueryParams(entity, query[1] as any[])
  });

  const assertInsertQueryParams = (actual: TestDbEntity, expected: any[]) => {
    expect(expected[0]).toBe(actual.company_id);
    expect(expected[1]).toBe(actual.id);
    expect(expected[2]).toBe(actual.parent_id);
    expect(expected[3]).toBe(actual.is_in_trash);
    expect(expected[4]).toBe( JSON.stringify(actual.tags));
    expect(expected[5]).toBe(actual.added);
  }

  const assertUpdateQueryParams = (actual: TestDbEntity, expected: string[]) => {
    expect(expected[0]).toBe(actual.parent_id);
    expect(expected[1]).toBe(actual.is_in_trash);
    expect(expected[2]).toBe( JSON.stringify(actual.tags));
    expect(expected[3]).toBe(actual.added);
    expect(expected[4]).toBe(actual.company_id);
    expect(expected[5]).toBe(actual.id);
  }


});
