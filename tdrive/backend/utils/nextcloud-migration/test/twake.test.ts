import { expect, test } from '@jest/globals';
import { TwakeDriveClient } from '../src/twake_client';

//FOR LOCAL DEBUG PURPOSE ONLY, ITS NOT A TEST
describe.skip('twake client module', () => {

  const subj = new TwakeDriveClient({
    url: "http://localhost:4000",
    credentials: {
      appId: "tdrive_onlyoffice",
      secret: "c1cc66db78e1d3bb4713c55d5ab2"
    }
  })

  test('twake creates new user and files for the user', async () => {
    //when
    let user = await subj.createUser({firstName: "DWHO", lastName: "DWHO", email: "dwho@example.com", uid: "test"});
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();

    user = await subj.getUser(user.id);
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();

    const dir = await subj.createDirectory("My DIR", "user_" + user.id)
    const doc = await subj.createFile("/Users/shepilov/WebstormProjects/TDrive/tdrive/backend/utils/nextcloud-migration/src/nextcloud_migration.ts", dir.id);
    expect(doc).toBeDefined();
    expect(doc.id).toBeDefined();

    const item = await subj.getDocument("user_" + user.id);
    expect(item.children.filter(i => i.name.startsWith("My DIR")).length).toBeGreaterThan(0);
  });

});