import {
  PostgresQueryBuilder
} from "../../../../../../../../../src/core/platform/services/database/services/orm/connectors/postgres/postgres-query-builder";
import { jest } from "@jest/globals";
import { randomInt, randomUUID } from "crypto";
import { newTestDbEntity, normalizeWhitespace, TestDbEntity } from "./utils";
import {
  comparisonType
} from "../../../../../../../../../src/core/platform/services/database/services/orm/repository/repository";

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
    expect(normalizeWhitespace(query[0] as string)).toBe("SELECT * FROM test_table WHERE id = $1 AND company_id = $2 ORDER BY id DESC LIMIT 100 OFFSET 0");
    expect(query[1]).toEqual([filter.id, filter.company_id]);
  });

  test('buildSelect query with array in filters', async () => {
    //given
    const filter = {id: randomUUID(), company_id: [randomUUID(), randomUUID()] };

    //when
    const query = subj.buildSelect(TestDbEntity, filter as { [key: string]: any }, null);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe("SELECT * FROM test_table WHERE id = $1 AND company_id IN ($2,$3) ORDER BY id DESC LIMIT 100 OFFSET 0");
    expect(query[1]).toEqual([filter.id, filter.company_id[0], filter.company_id[1]]);
  });

  test('buildSelect query "lt" options', async () => {
    //given
    const options = { $lt: [["added", randomInt(10)] as comparisonType, ["added", randomInt(10)] as comparisonType]};

    //when
    const query = subj.buildSelect(TestDbEntity, null, options);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe("SELECT * FROM test_table WHERE added < $1 AND added < $2 ORDER BY id DESC LIMIT 100 OFFSET 0");
    expect(query[1]).toEqual(options.$lt.map(e=> e[1]));
  });

  test('buildSelect query "gt" options', async () => {
    //given
    const options = { $gt: [["added", randomInt(10)] as comparisonType, ["added", randomInt(10)] as comparisonType]};

    //when
    const query = subj.buildSelect(TestDbEntity, null, options);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe("SELECT * FROM test_table WHERE added > $1 AND added > $2 ORDER BY id DESC LIMIT 100 OFFSET 0");
    expect(query[1]).toEqual(options.$gt.map(e=> e[1]));
  });

  test('buildSelect query "in" options', async () => {
    //given
    const options = { $in: [["added", [randomInt(10), randomInt(10)]] as comparisonType,]};

    //when
    const query = subj.buildSelect(TestDbEntity, null, options);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe("SELECT * FROM test_table WHERE added IN ($1,$2) ORDER BY id DESC LIMIT 100 OFFSET 0");
    expect(query[1]).toEqual(options.$in[0][1]);
  });

  test('buildSelect query "like" options', async () => {
    //given
    const options = { $like: [["id", randomUUID()] as comparisonType, ["company_id", randomUUID()] as comparisonType]};

    //when
    const query = subj.buildSelect(TestDbEntity, null, options);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe("SELECT * FROM test_table WHERE id LIKE $1 AND company_id LIKE $2 ORDER BY id DESC LIMIT 100 OFFSET 0");
    expect(query[1]).toEqual(options.$like.map(e=> `%${e[1]}%`));
  });

  test('buildDelete query', async () => {
    //given
    const entity = newTestDbEntity();

    //when
    const query = subj.buildDelete(entity);

    //then
    expect(normalizeWhitespace(query[0] as string)).toBe("DELETE FROM test_table WHERE company_id = $1 AND id = $2");
    expect(query[1]).toEqual([entity.company_id, entity.id]);
  });


});
