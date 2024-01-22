import ldap, { SearchOptions } from "ldapjs";
import { logger } from "./logger";
import { User, UserProvider } from "./user_privider";

export type LdapConfiguration = {
  url: string,
  baseDn: string,
}

// Doesn't work, fix it later, somehow none of the events is called for the search request
export class LdapUserProvider implements UserProvider {

  private config: LdapConfiguration;

  private client?: ldap.Client;

  constructor(config: LdapConfiguration) {
    this.config = config;
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