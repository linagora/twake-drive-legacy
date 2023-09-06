import ldap from "ldapjs";
import axios from "axios";
import dotenv from "dotenv";

interface UserAttributes {
  first_name: string;
  last_name: string;
  email: string;
}

dotenv.config();

console.log("Run script with the following env:");
console.log(process.env);

// LDAP server configuration
const ldapConfig = {
  url: process.env.LDAP_URL|| "localhost",
  bindDN: process.env.LDAP_BIND_DN || "",
  bindCredentials: process.env.LDAP_BIND_CREDENTIALS || "",
  searchBase: process.env.LDAP_SEARCH_BASE || "dc=example,dc=com",
  searchFilter: process.env.LDAP_SEARCH_FILTER || "(objectClass=inetorgperson)",
  timeout: 120,
  version: 3,
};

// Create LDAP client
const client = ldap.createClient({
  url: ldapConfig.url,
});

// Bind to LDAP server
client.bind(ldapConfig.bindDN, ldapConfig.bindCredentials, (err) => {
  if (err) {
    console.error("LDAP bind error:", err);
    return;
  }

  // Perform search
  client.search(
    ldapConfig.searchBase,
    {
      filter: ldapConfig.searchFilter,
      attributes: ["uid", "mail", "cn", "sn", "mobile"],
      scope: "sub",
      derefAliases: 2,
    },
    (searchErr, searchRes) => {
      if (searchErr) {
        console.error("LDAP search error:", searchErr);
        return;
      }

      const apiRequests: Promise<any>[] = [];

      searchRes.on("searchEntry", (entry: any) => {
        // Handle each search result entry
        const userAttributes: UserAttributes = {
          first_name: entry.attributes[1]?.values[0],
          last_name: entry.attributes[2]?.values[0],
          email: entry.attributes[3]?.values[0],
        };

        // Make API call to tdrive backend with the userAttributes
        apiRequests.push(axios.post(process.env.API_URL || "", userAttributes));
      });

      searchRes.on("error", (err) => {
        console.error("LDAP search result error:", err);
      });

      searchRes.on("end", () => {
        // Unbind from LDAP server after search is complete
        client.unbind((unbindErr) => {
          if (unbindErr) {
            console.error("LDAP unbind error:", unbindErr);
          } else {
            Promise.all(apiRequests)
              .then((responses) => {
                console.log(
                  "API responses:",
                  responses.map((r) => r.data)
                );
              })
              .catch((error) => {
                console.error("API error:", error);
              })
              .finally(() => {
                console.log("LDAP search completed successfully.");
              });
          }
        });
      });
    }
  );
});
