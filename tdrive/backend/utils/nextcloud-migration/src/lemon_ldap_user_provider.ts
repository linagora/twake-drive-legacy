import { User, UserProvider } from "./user_privider";
import axios, { AxiosInstance } from "axios";

export interface LemonLdapUserProviderConfig {
  url: string,
  auth: string,
}

export class LemonLdapUserProvider implements UserProvider {

  private client: AxiosInstance;

  constructor(private config: LemonLdapUserProviderConfig) {
    this.client = axios.create({
      baseURL: config.url,
      headers: {
        Authorization: `Bearer ${config.auth}`,
      },
    });
  }

  async find(username: string): Promise<User> {
    const response = await this.client.post("", [username]);
    if (response.status == 200 && response.data) {
      const u: any = response.data[username];
      if (u && u.length > 0) {
        if (u) {
          const user = {
            firstName: u[0].filter(f => f[0] === "givenName").map(f => f[1])[0],
            lastName: u[0].filter(f => f[0] === "sn").map(f => f[1])[0],
            email: u[0].filter(f => f[0] === "mail").map(f => f[1])[0],
            uid: u[0].filter(f => f[0] === "uid").map(f => f[1])[0]
          }
          if (user.uid && !user.email) {
            user.email = `${user.uid}@cnb.linagora.com`;
          }
          return user;
        }
      }
    }
    return {} as User;
  }

}

