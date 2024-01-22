import {describe, expect, test} from '@jest/globals';
import { ShellLdapUserProvider } from '../src/shell_ldap_user';
import { LdapConfiguration } from '../src/ldap_user';

//FOR LOCAL DEBUG PURPOSE ONLY, ITS NOT A TEST
describe.skip('Shell LDAP User Provider', () => {

  test('ldap returns user info', async () => {
    const ldap = new ShellLdapUserProvider({
      url: "ldap://auth.poc-mail-avocat.fr:389",
      baseDn: "ou=users,dc=example,dc=com",
    } as LdapConfiguration);
    const user = await ldap.find("999248");
    expect(user.firstName).toBe("Xavier");
    expect(user.lastName).toBe("GUIMARD");
    expect(user.email).toBe("xguimard@preprod-avocat.fr");
    expect(user.uid).toBe("999248");
  });

  test('ldap returns nothing', async () => {
    const ldap = new ShellLdapUserProvider({
      url: "ldap://auth.poc-mail-avocat.fr:389",
      baseDn: "ou=users,dc=example,dc=com",
    } as LdapConfiguration);
    const user = await ldap.find("NOTHING_HERE");
    expect(user.email).toBeUndefined();
  });

});