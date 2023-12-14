import {describe, expect, test} from '@jest/globals';
import { LdapUser } from '../src/shell_ldap_user';
import { LdapConfiguration } from '../src/ldap_user';

//integration debug test
describe.skip('ldap module', () => {

  test('ldap returns user info', async () => {
    const ldap = new LdapUser({
      url: "ldap://auth.poc-mail-avocat.fr:389",
      baseDn: "ou=users,dc=example,dc=com",
    } as LdapConfiguration);
    const user = await ldap.find("999248");
    expect(user.firstName).toBe("Xavier");
    expect(user.lastName).toBe("GUIMARD");
    expect(user.email).toBe("xguimard@avocat.fr");
    expect(user.uid).toBe("999248");
  });

  test('ldap returns nothing', async () => {
    const ldap = new LdapUser({
      url: "ldap://auth.poc-mail-avocat.fr:389",
      baseDn: "ou=users,dc=example,dc=com",
    } as LdapConfiguration);
    const user = await ldap.find("NOTHING_HERE");
    expect(user.email).toBeUndefined();
  });

});