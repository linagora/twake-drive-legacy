import 'reflect-metadata';

import { describe, expect, it, jest } from '@jest/globals';
import {
  PostgresConnectionOptions,
  PostgresConnector, TableRowInfo
} from "../../../../../../../../../src/core/platform/services/database/services/orm/connectors/postgres/postgres";
import { getEntityDefinition } from '../../../../../../../../../src/core/platform/services/database/services/orm/utils';
import { Column, Entity } from "../../../../../../../../../src/core/platform/services/database/services/orm/decorators";
import { Type } from "class-transformer";

describe('The Postgres Connector module', () => {

  const subj: PostgresConnector = new PostgresConnector('postgres', {} as PostgresConnectionOptions, '');
  let dbQuerySpy;

  beforeEach(async () => {
    dbQuerySpy = jest.spyOn(subj.client, 'query');
    //healthcheck mock
    dbQuerySpy
      .mockReturnValueOnce({rows: [{now: 1}], rowCount: 1});
    jest.spyOn(subj.client, 'connect').mockImplementation(jest.fn);
    await subj.connect();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('createTable test generated DB query', async () => {
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
    expect(dbQuerySpy).toHaveBeenCalledTimes(7);
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[1][0])).toBe(normalizeWhitespace("CREATE TABLE IF NOT EXISTS test_table ( company_id UUID, id UUID, parent_id UUID, is_in_trash BOOLEAN, tags TEXT, added BIGINT );"))
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[2][0])).toBe(normalizeWhitespace("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name = $1"));
    expect(dbQuerySpy.mock.calls[2][1]).toStrictEqual(["test_table"])
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[3][0])).toBe("ALTER TABLE test_table ADD COLUMN id UUID, ADD COLUMN is_in_trash BOOLEAN, ADD COLUMN tags TEXT, ADD COLUMN added BIGINT")
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[4][0])).toBe("ALTER TABLE test_table ADD PRIMARY KEY ( company_id, id);")
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[5][0])).toBe("CREATE INDEX IF NOT EXISTS index_test_table_company_id_parent_id ON test_table ((company_id), parent_id)")
    expect(normalizeWhitespace(dbQuerySpy.mock.calls[6][0])).toBe("CREATE INDEX IF NOT EXISTS index_test_table_company_id_is_in_trash ON test_table ((company_id), is_in_trash)")
  });
});

const normalizeWhitespace = (query: string) => query.replace(/\s+/g, ' ').trim();

@Entity("test_table", {
  globalIndexes: [
    ["company_id", "parent_id"],
    ["company_id", "is_in_trash"],
  ],
  primaryKey: [["company_id"], "id"],
  type: "test_table",
})
// @ts-ignore
export class TestDbEntity {

  @Type(() => String)
  @Column("company_id", "uuid")
  // @ts-ignore
  company_id: string;

  @Type(() => String)
  @Column("id", "uuid", { generator: "uuid" })
  // @ts-ignore
  id: string;

  @Type(() => String)
  @Column("parent_id", "uuid")
  // @ts-ignore
  parent_id: string;

  @Type(() => Boolean)
  @Column("is_in_trash", "boolean")
  // @ts-ignore
  is_in_trash: boolean;

  @Column("tags", "encoded_json")
  // @ts-ignore
  tags: string[];

  @Type(() => Number)
  @Column("added", "number")
  // @ts-ignore
  added: number;

}