import { ShellLdapUserProvider } from "./shell_ldap_user";
import { LemonLdapUserProvider } from "./lemon_ldap_user_provider";
import { LdapUserProvider } from "./ldap_user";

export type User = {
  firstName: string,
  lastName: string,
  email: string,
  uid: string
}

export type UserProviderType = "lemon" | "ldap" | "shell";

export interface UserProvider {
  find(username: string): Promise<User>
}

export class UserProviderFactory {

  get(type: UserProviderType, config: any) {
    switch (type) {
      case "shell":
        return new ShellLdapUserProvider(config)
      case "ldap":
        return new LdapUserProvider(config);
      case "lemon":
        return new LemonLdapUserProvider(config);
      default:
        return new ShellLdapUserProvider(config);
    }
  }

}