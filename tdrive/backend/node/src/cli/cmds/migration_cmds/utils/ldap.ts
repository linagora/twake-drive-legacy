import ldap, { type SearchEntry, type Client } from "ldapjs";
import dotenv from "dotenv";

dotenv.config();

interface LdapConfig {
  url: string;
  bindDN: string;
  bindCredentials: string;
  searchBase: string;
}

/**
 * Retrieves the LDAP configuration from environment variables.
 *
 * @returns {LdapConfig} The LDAP configuration object.
 */
function getLdapConfig(): LdapConfig {
  return {
    url: process.env.LDAP_URL || "localhost",
    bindDN: process.env.LDAP_BIND_DN || "",
    bindCredentials: process.env.LDAP_BIND_CREDENTIALS || "",
    searchBase: process.env.LDAP_SEARCH_BASE || "dc=example,dc=com",
  };
}

/**
 * creates a ldap client and binds to the ldap server
 *
 * @param {LdapConfig} config - the LDAP connection config
 * @returns {Promise<Client>} A promise that resolves to the LDAP client instance.
 */
function createLdapClient(config: LdapConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url: config.url });
    client.bind(config.bindDN, config.bindCredentials, err => {
      if (err) {
        client.unbind();
        reject(err);
      } else {
        resolve(client);
      }
    });
  });
}

/**
 * Searches for a user in LDAP by username and returns their mobile number.
 *
 * @param {Client} client The LDAP client instance.
 * @param {LdapConfig} config The LDAP configuration.
 * @param {string} username The username to search for.
 * @returns A promise that resolves to the user's mobile number, or null if not found.
 */
function searchForUserMobile(
  client: Client,
  config: LdapConfig,
  username: string,
): Promise<string | null> {
  console.log(`searching for user ${username} mobile in LDAP`);

  return new Promise((resolve, reject) => {
    client.search(
      config.searchBase,
      {
        filter: `(cn=${username})`,
        attributes: ["mobile"],
        scope: "sub",
      },
      (searchErr, searchResult) => {
        if (searchErr) return reject(searchErr);

        let found = false;

        searchResult.on("searchEntry", (entry: SearchEntry) => {
          const mobile = entry.attributes.find(a => a.type === "mobile")?.vals[0];

          found = true;
          resolve(mobile || null);
        });

        searchResult.on("error", reject);
        searchResult.on("end", () => !found && resolve(null));
      },
    );
  });
}

/**
 * Fetches the mobile number for a given username from LDAP.
 *
 * @param {string} username The username to search for in LDAP.
 * @returns A promise that resolves to the user's mobile number, or null if not found.
 */
export async function getLDAPUserMobile(username: string): Promise<string | null> {
  const config = getLdapConfig();
  const client = await createLdapClient(config);

  try {
    return await searchForUserMobile(client, config, username);
  } catch (error) {
    console.log("LDAP search error", error);

    return null;
  } finally {
    client.unbind();
  }
}
