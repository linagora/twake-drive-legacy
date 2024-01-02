import ldap, { SearchEntry, SearchOptions } from 'ldapjs';
import { logger } from "./logger"

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
          logger.info("Successfully authenticated in LDAP")
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
          logger.info("Connected to LDAP")
          resolve(this.auth("", ""));
        })
        this.client.on('connectionError', (error) => {
          logger.info("Error connecting to LDAP")
          reject(error);
        });
      }
    });
  }

  async find(username: string): Promise<User> {
    const search = await this.search(username);
    return new Promise<User>((resolve, reject) => {
      search.on('error', (err) => {
        logger.info("ERROR");
        logger.info(err);
      });
      search.on('searchRequest', (searchRequest) => {
        logger.info('searchRequest: ', searchRequest.messageId);
      });
      search.on('searchEntry', (entry) => {
        logger.info('entry: ' + JSON.stringify(entry));
      });
      search.on('searchReference', (referral) => {
        logger.info('referral: ' + referral.uris.join());
      });
      search.on('end', (err) => {
        logger.info("END");
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
      logger.info(`Search in ${this.config.baseDn} with options`);
      // Perform search
      this.client?.search(this.config.baseDn, opts, (error, res) => {
        if (error) {
          console.error("Search error", error);
          reject(error)
        } else {
          logger.info("returning search callback");
          resolve(res);
        }
      });
    });
  }

}