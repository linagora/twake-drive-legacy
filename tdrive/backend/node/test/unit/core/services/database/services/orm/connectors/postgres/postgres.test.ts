import 'reflect-metadata';

import { describe, expect, jest } from '@jest/globals';
import {
  PostgresConnectionOptions,
  PostgresConnector, TableRowInfo
} from "../../../../../../../../../src/core/platform/services/database/services/orm/connectors/postgres/postgres";
import { getEntityDefinition } from '../../../../../../../../../src/core/platform/services/database/services/orm/utils';
import { randomInt, randomUUID } from "crypto";
import { TestDbEntity, normalizeWhitespace} from "./utils";

describe('The Postgres Connector module', () => {

  const NUMBER_OF_HEALTHCHECK_CALLS = 1;

  const subj: PostgresConnector = new PostgresConnector('postgres', {} as PostgresConnectionOptions, '');
  let dbQuerySpy;

  beforeEach(async () => {
    dbQuerySpy = jest.spyOn((subj as any).client, 'query');
    //healthcheck mock
    dbQuerySpy
      .mockReturnValueOnce({rows: [{now: 1}], rowCount: 1});
    jest.spyOn((subj as any).client, 'connect').mockImplementation(jest.fn);
    await subj.connect();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('createTable generates table structure queries', async () => {
    // given
    const definition = getEntityDefinition(new TestDbEntity());
    dbQuerySpy
      //mock create table response
      .mockReturnValueOnce({ rows: [], rowCount: 1})
      //mock query for existing columns
      .mockReturnValueOnce({ rows: [{ column_name: "parent_id"} as TableRowInfo, { column_name: "company_id"}], rowCount: 1 })
      //mock alter table response
      .mockReturnValueOnce({ rows: [], rowCount: 1 })
      //mock alter table add primary key query response
      .mockReturnValueOnce({ rows: [], rowCount: 1 })
      //mock alter table create index query response
      .mockReturnValueOnce({ rows: [], rowCount: 1 })
      //mock alter table create index query response
      .mockReturnValueOnce({ rows: [], rowCount: 1 })

    //when
    await subj.createTable(definition.entityDefinition, definition.columnsDefinition);

    //then
    expect(dbQuerySpy).toHaveBeenCalledTimes(6 + NUMBER_OF_HEALTHCHECK_CALLS);
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[1][0])).toBe(normalizeWhitespace("CREATE TABLE IF NOT EXISTS test_table ( company_id UUID, id UUID, parent_id UUID, is_in_trash BOOLEAN, tags TEXT, added BIGINT );"))
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[2][0])).toBe(normalizeWhitespace("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name = $1"));
    expect(dbQuerySpy.mock.calls[2][1]).toStrictEqual(["test_table"])
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[3][0])).toBe("ALTER TABLE test_table ADD COLUMN id UUID, ADD COLUMN is_in_trash BOOLEAN, ADD COLUMN tags TEXT, ADD COLUMN added BIGINT")
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[4][0])).toBe("ALTER TABLE test_table ADD PRIMARY KEY ( company_id, id);")
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[5][0])).toBe("CREATE INDEX IF NOT EXISTS index_test_table_company_id_parent_id ON test_table ((company_id), parent_id)")
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[6][0])).toBe("CREATE INDEX IF NOT EXISTS index_test_table_company_id_is_in_trash ON test_table ((company_id), is_in_trash)")
  });

  test('upsert generates insert queries', async () => {
    //given
    const entities = [newTestDbEntity(), newTestDbEntity()];
    dbQuerySpy
      .mockReturnValueOnce({ rows: [], rowCount: 1})
      .mockReturnValueOnce({ rows: [], rowCount: 1})

    //when
    await subj.upsert(entities, { action: "INSERT"});

    //then
    expect(dbQuerySpy).toHaveBeenCalledTimes(2 + NUMBER_OF_HEALTHCHECK_CALLS);
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[1][0])).toBe(normalizeWhitespace("INSERT INTO test_table (company_id, id, parent_id, is_in_trash, tags, added) VALUES ($1, $2, $3, $4, $5, $6)"))
    assertInsertQueryParams(entities[0], dbQuerySpy.mock.calls[1][1])
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[2][0])).toBe(normalizeWhitespace("INSERT INTO test_table (company_id, id, parent_id, is_in_trash, tags, added) VALUES ($1, $2, $3, $4, $5, $6)"))
    assertInsertQueryParams(entities[1], dbQuerySpy.mock.calls[2][1])
  });



  test('upsert generates update queries', async () => {
    const entities = [newTestDbEntity(), newTestDbEntity()];
    dbQuerySpy
      .mockReturnValueOnce({ rows: [], rowCount: 1})
      .mockReturnValueOnce({ rows: [], rowCount: 1})

    //when
    await subj.upsert(entities, { action: "UPDATE"});

    //then
    expect(dbQuerySpy).toHaveBeenCalledTimes(2 + NUMBER_OF_HEALTHCHECK_CALLS);
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[1][0])).toBe(normalizeWhitespace("UPDATE test_table SET parent_id = $1, is_in_trash = $2, tags = $3, added = $4 WHERE company_id = $5 AND id = $6"))
    assertUpdateQueryParams(entities[0], dbQuerySpy.mock.calls[1][1])
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[2][0])).toBe(normalizeWhitespace("UPDATE test_table SET parent_id = $1, is_in_trash = $2, tags = $3, added = $4 WHERE company_id = $5 AND id = $6"))
    assertUpdateQueryParams(entities[1], dbQuerySpy.mock.calls[2][1])
  });
});

const assertInsertQueryParams = (actual: TestDbEntity, expected: string[]) => {
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


const newTestDbEntity = () => {
  return new TestDbEntity({
    company_id: randomUUID(),
    id: randomUUID(),
    parent_id: randomUUID(),
    is_in_trash: true,
    tags: [randomUUID(), randomUUID()],
    added: randomInt(1, 1000)
  })
}
