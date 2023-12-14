import ldap, { SearchEntry, SearchOptions } from 'ldapjs';

export type LdapConfiguration = {
  url: string,
  baseDn: string,
}

export type User = {
  firstName: string,
  lastName: string,
  email: string,
  uid: string
}

// Doesn't work, fix it later, somehow none of the events is called for the search request
export class LdapUser {

  private config: LdapConfiguration;

  private client?: ldap.Client;

  constructor(config: LdapConfiguration) {
    this.config = config;
  }

  async auth(username: string, password: string) {
    return new Promise((resolve, reject) => {
      this.client?.bind(username, password, (error) => {
        if (error) {
          reject(new Error("Authentication error"));
        } else {
          console.log("Successfully authenticated in LDAP")
          resolve(this.client);
        }
      });
    });
  }

  async connect() {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        this.client = ldap.createClient({
          url: this.config.url,
          reconnect: true
        });
        this.client.on('connect', (res) => {
          console.log("Connected to LDAP")
          resolve(this.auth("", ""));
        })
        this.client.on('connectionError', (error) => {
          console.log("Error connecting to LDAP")
          reject(error);
        });
      }
    });
  }

  async find(username: string): Promise<User> {
    const search = await this.search(username);
    return new Promise<User>((resolve, reject) => {
      search.on('error', (err) => {
        console.log("ERROR");
        console.log(err);
      });
      search.on('searchRequest', (searchRequest) => {
        console.log('searchRequest: ', searchRequest.messageId);
      });
      search.on('searchEntry', (entry) => {
        console.log('entry: ' + JSON.stringify(entry));
      });
      search.on('searchReference', (referral) => {
        console.log('referral: ' + referral.uris.join());
      });
      search.on('end', (err) => {
        console.log("END");
      });
    });
  }

  async search(username: string): Promise<ldap.SearchCallbackResponse> {
    return new Promise<ldap.SearchCallbackResponse>((resolve, reject) => {
      const opts = {
        filter: `(objectClass=*)`,
        attributes: ['cn', 'sn'],
        scope: 'sub',
      } as SearchOptions;
      console.log(`Search in ${this.config.baseDn} with options`);
      // Perform search
      this.client?.search(this.config.baseDn, opts, (error, res) => {
        if (error) {
          console.error("Search error", error);
          reject(error)
        } else {
          console.log("returning search callback");
          resolve(res);
        }
      });
    });
  }

}