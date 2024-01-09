import 'reflect-metadata';

import { describe, expect, it, jest } from '@jest/globals';
import { Column, Entity } from "../../../../../../../src/core/platform/services/database/services/orm/decorators";
import { Type } from "class-transformer";
import EntityManager from "../../../../../../../src/core/platform/services/database/services/orm/manager";
import { Connector } from "../../../../../../../src/core/platform/services/database/services/orm/connectors";
import { randomUUID } from "crypto";

describe('EntityManager module', () => {

  const subj: EntityManager<TestDbEntity> = new EntityManager<TestDbEntity>({ } as Connector);

  beforeEach(async () => {
  });

  afterEach(() => {
    jest.clearAllMocks();
    subj.reset();
  });

  test ("persist should store entity to insert if all fields for pk is empty", () => {
    //when
    subj.persist(new TestDbEntity());

    //then
    expect((subj as any).toInsert.length).toEqual(1);
    expect((subj as any).toUpdate.length).toEqual(0);
    expect((subj as any).toRemove.length).toEqual(0);
    expect((subj as any).toInsert[0].id).toBeDefined();
    expect((subj as any).toInsert[0].company_id).toBeDefined();
  });

  test ("persist should store entity to insert if id is set", () => {
    //when
    subj.persist(new TestDbEntity({id: randomUUID()}));

    //then
    expect((subj as any).toInsert.length).toEqual(1);
    expect((subj as any).toUpdate.length).toEqual(0);
    expect((subj as any).toRemove.length).toEqual(0);
    expect((subj as any).toInsert[0].id).toBeDefined();
    expect((subj as any).toInsert[0].company_id).toBeDefined();
  });

  test ("persist should store entity to insert if company_id is set", () => {
    //when
    subj.persist(new TestDbEntity({company_id: randomUUID()}));

    //then
    expect((subj as any).toInsert.length).toEqual(1);
    expect((subj as any).toUpdate.length).toEqual(0);
    expect((subj as any).toRemove.length).toEqual(0);
    expect((subj as any).toInsert[0].id).toBeDefined();
    expect((subj as any).toInsert[0].company_id).toBeDefined();
  });

  test ("persist should store entity to update if all pk fields are set", () => {
    //when
    let entity = new TestDbEntity({id: randomUUID(), company_id: randomUUID()});
    subj.persist(entity);

    //then
    expect((subj as any).toUpdate.length).toEqual(1);
    expect((subj as any).toInsert.length).toEqual(0);
    expect((subj as any).toRemove.length).toEqual(0);
    expect((subj as any).toUpdate[0]).toEqual(entity)
  });
});

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

  public constructor(init?:Partial<TestDbEntity>) {
    Object.assign(this, init);
  }

}