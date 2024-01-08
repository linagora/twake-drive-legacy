import 'reflect-metadata';

import { DriveFile } from "../../../../../../../../../src/services/documents/entities/drive-file";
import { describe, it } from '@jest/globals';
import {
  PostgresConnectionOptions,
  PostgresConnector,
} from '../../../../../../../../../src/core/platform/services/database/services/orm/connectors/postgres/postgres';
import { getEntityDefinition } from '../../../../../../../../../src/core/platform/services/database/services/orm/utils';
import { randomUUID } from "crypto";
import { now } from "moment";

//THIS IS NOT TEST, IT'S JUST RUNNER TO TEST POSTGRESQL API
describe.skip('The Postgres Connector module', () => {

  const subj: PostgresConnector = new PostgresConnector('postgres', {
    user: "tdrive_user",
    password: "tdrive_secret",
    database: "tdrive",
    port: 5432,
    host: "localhost",
    statement_timeout: 10000,
    query_timeout: 10000

  } as PostgresConnectionOptions, '');



  it('createTable test ALTER TABLE query', async () => {
    let driveFile = new DriveFile();
    const definition = getEntityDefinition(driveFile);
    await subj.connect();
    //when
    await subj.createTable(definition.entityDefinition, definition.columnsDefinition);

    driveFile.name = "My Test File";
    driveFile.company_id = randomUUID();
    driveFile.access_info = {
      entities: [],
      public: {
        token: randomUUID(),
        password: randomUUID(),
        expiration: now(),
        level: "read",
      }
    }
    driveFile.is_directory = false;
    driveFile.is_in_trash = true;
    driveFile.tags = ["mytag", "ehey"]


    //then
  }, 3000000);

});