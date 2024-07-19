import 'reflect-metadata';

import { describe, expect, it, jest } from '@jest/globals';
import EntityManager from "../../../../../../../src/core/platform/services/database/services/orm/manager";
import { Connector } from "../../../../../../../src/core/platform/services/database/services/orm/connectors";
import { randomUUID } from "crypto";
import { TestDbEntity } from "./connectors/postgres/utils";
import WorkspaceUser, { getInstance } from "../../../../../../../src/services/workspaces/entities/workspace_user";

describe('EntityManager', () => {

  let connector = { upsert: () => void 0};
  const subj: EntityManager<TestDbEntity> = new EntityManager<TestDbEntity>(connector as unknown as Connector);
  let upsert;

  beforeEach(async () => {
    upsert = jest.spyOn((subj as any).connector, "upsert");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test ("persist should store entity to insert if all fields for pk is empty", () => {
    //when
    let entity = new TestDbEntity();
    subj.persist(entity);

    //then
    expect(upsert).toBeCalledTimes(1);
    expect(upsert).toBeCalledWith([entity], {"action": "INSERT"})
  });

  test ("persist should store entity to insert if id is set", () => {
    //when
    let entity = new TestDbEntity({id: randomUUID()});
    subj.persist(entity);

    //then
    expect(upsert).toBeCalledTimes(1);
    expect(upsert).toBeCalledWith([entity], {"action": "INSERT"})
  });

  test ("persist should store entity to insert if company_id is set", () => {
    //when
    let entity = new TestDbEntity({company_id: randomUUID()});
    subj.persist(entity);

    //then
    expect(upsert).toBeCalledTimes(1);
    expect(upsert).toBeCalledWith([entity], {"action": "INSERT"})
  });

  test ("persist should store entity to update if all pk fields are set", () => {
    //when
    let entity = new TestDbEntity({id: randomUUID(), company_id: randomUUID()});
    subj.persist(entity);

    //then
    expect(upsert).toBeCalledTimes(1);
    expect(upsert).toBeCalledWith([entity], {"action": "UPDATE"})
  });

  test ("persist should store entity to update if all pk fields are set and column name is different from field name", () => {
    //when
    let entity = getInstance({id: randomUUID(), workspaceId: randomUUID(), userId: randomUUID()});
    subj.persist(entity);

    //then
    expect(upsert).toBeCalledTimes(1)
    expect(upsert).toBeCalledWith([entity], {"action": "UPDATE"})
  });

  test ("persist should store entity to insert if not all pk fields are set and column name is different from field name", () => {
    //when
    let entity = getInstance({id: randomUUID(), workspaceId: randomUUID()});
    subj.persist(entity);

    //then
    expect(upsert).toBeCalledWith([entity], {"action": "INSERT"})
  });

});
