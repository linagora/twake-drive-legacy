import {describe, expect, test} from '@jest/globals';
import { LemonLdapUserProvider, LemonLdapUserProviderConfig } from "../src/lemon_ldap_user_provider";

//FOR LOCAL DEBUG PURPOSE ONLY, ITS NOT A TEST
describe.skip('Lemon LDAP User Provider', () => {

  test('ldap returns user info', async () => {
    const ldap = new LemonLdapUserProvider({
      url: "https://auth.avocat.fr/_getldapentries",
      auth: "isPnOTuBwjqAlIdCFGNY",
    });
    const user = await ldap.find("999248");
    expect(user.firstName).toBe("Xavier");
    expect(user.lastName).toBe("GUIMARD");
    expect(user.email).toBe("999248@cnb.linagora.com");
    expect(user.uid).toBe("999248");
  });

  test('ldap returns user info with email', async () => {
    const ldap = new LemonLdapUserProvider({
      url: "https://auth.avocat.fr/_getldapentries",
      auth: "isPnOTuBwjqAlIdCFGNY",
    });
    const user = await ldap.find("999253");
    expect(user.firstName).toBe("Utilisateur4");
    expect(user.lastName).toBe("ONBOARDING4");
    expect(user.email).toBe("utilisateur4.onboarding4@avocat.fr");
    expect(user.uid).toBe("999253");
  });

  test('ldap returns nothing', async () => {
    const ldap = new LemonLdapUserProvider({
      url: "https://auth.avocat.fr/_getldapentries",
      auth: "isPnOTuBwjqAlIdCFGNY",
    });
    const user = await ldap.find("NOTHING_HERE");
    expect(user.email).toBeUndefined();
  });

});