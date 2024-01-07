import 'reflect-metadata';

import { DriveFile } from '../../../../../../../../../src/services/documents/entities/drive-file';
import { describe, it } from '@jest/globals';
import {
  PostgresConnectionOptions,
  PostgresConnector,
} from '../../../../../../../../../src/core/platform/services/database/services/orm/connectors/postgres/postgres';
import { getEntityDefinition } from '../../../../../../../../../src/core/platform/services/database/services/orm/utils';

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
    const definition = getEntityDefinition(new DriveFile());
    await subj.connect();
    //when
    await subj.createTable(definition.entityDefinition, definition.columnsDefinition);
    //then
  }, 3000000);

});