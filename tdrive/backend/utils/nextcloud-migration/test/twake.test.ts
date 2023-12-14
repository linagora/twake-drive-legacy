import { expect, test } from '@jest/globals';
import { TwakeDriveClient } from '../src/twake_client';

//integration debug test
describe.skip('twake client module', () => {

  test('twake creates new user', async () => {
    //given
    const subj = new TwakeDriveClient({
        url: "https://tdrive.qa.lin-saas.com/",
        credentials: {
          appId: "tdrive_onlyoffice",
          secret: "QWERTY"
        }
    })

    //when
    const response = await subj.createUser({firstName: "Test", lastName: "User", email: "test@example.com", uid: "test"});
    expect(response).toBeDefined();
    console.log(response);
  });

});