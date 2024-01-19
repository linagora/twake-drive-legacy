import 'reflect-metadata';

import { describe, expect, it, jest } from '@jest/globals';
import EntityManager from "../../../../../../../src/core/platform/services/database/services/orm/manager";
import { Connector } from "../../../../../../../src/core/platform/services/database/services/orm/connectors";
import { randomUUID } from "crypto";
import { TestDbEntity } from "./connectors/postgres/utils";
import WorkspaceUser, { getInstance } from "../../../../../../../src/services/workspaces/entities/workspace_user";

describe('EntityManager', () => {

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

  test ("persist should store entity to update if all pk fields are set and column name is different from field name", () => {
    //when
    let entity = getInstance({id: randomUUID(), workspaceId: randomUUID(), userId: randomUUID()});
    subj.persist(entity);

    //then
    expect((subj as any).toUpdate.length).toEqual(1);
    expect((subj as any).toInsert.length).toEqual(0);
    expect((subj as any).toRemove.length).toEqual(0);
    expect((subj as any).toUpdate[0]).toEqual(entity)
  });

  test ("persist should store entity to insert if not all pk fields are set and column name is different from field name", () => {
    //when
    let entity = getInstance({id: randomUUID(), workspaceId: randomUUID()});
    subj.persist(entity);

    //then
    expect((subj as any).toUpdate.length).toEqual(0);
    expect((subj as any).toInsert.length).toEqual(1);
    expect((subj as any).toRemove.length).toEqual(0);
    expect((subj as any).toInsert[0]).toEqual(entity);
    expect(entity.userId).toBeDefined();
  });

});
