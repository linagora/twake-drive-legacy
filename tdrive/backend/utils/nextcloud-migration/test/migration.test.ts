import { expect, test } from '@jest/globals';
import { TwakeDriveClient, TwakeDriveUser } from '../src/twake_client';
import { NextcloudMigration, NextcloudMigrationConfiguration } from '../src/nextcloud_migration';

//FOR LOCAL DEBUG PURPOSE ONLY, ITS NOT A TEST
describe.skip('nextcloud migration module', () => {

  test('upload directory', async () => {
    //given
    const subj = new NextcloudMigration({
      drive: {
        url: "http://localhost:4000",
        credentials: {
          appId: "tdrive_onlyoffice",
          secret: "c1cc66db78e1d3bb4713c55d5ab2"
        }
      }
    } as NextcloudMigrationConfiguration);

    let user = await subj.driveClient.createUser({firstName: "DWHO", lastName: "DWHO", email: "dwho@example.com", uid: "test"});

    //when
    await subj.upload(user, "/Users/shepilov/WebstormProjects/TDrive/Documentation/docs/onprem");
  });

});