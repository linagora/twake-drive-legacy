import ldap, { SearchEntry } from "ldapjs";
import axios, { AxiosError } from "axios";
import dotenv from "dotenv";

interface UserAttributes {
  first_name: string;
  last_name: string;
  email: string;
}

export interface IApiServiceApplicationTokenRequestParams {
  id: string;
  secret: string;
}

export interface IApiServiceApplicationTokenResponse {
  resource: {
    access_token: {
      time: number;
      expiration: number;
      value: string;
      type: string;
    };
  };
}

dotenv.config();
console.log("Run script with the following env: ");
console.log(process.env);

const ldapConfig = {
  url: process.env.LDAP_URL || "localhost",
  bindDN: process.env.LDAP_BIND_DN || "",
  bindCredentials: process.env.LDAP_BIND_CREDENTIALS || "",
  searchBase: process.env.LDAP_SEARCH_BASE || "dc=example,dc=com",
  searchFilter: process.env.LDAP_SEARCH_FILTER || "(objectClass=inetorgperson)",
  mappings: JSON.parse(process.env.LDAP_ATTRIBUTE_MAPPINGS || "{}"),
  timeout: 120,
  version: 3,
};

const tdriveConfig = {
    url: process.env.TDRIVE_URL || "http://localhost:4000/)",
    credentials: {
      id: process.env.TDRIVE_CREDENTIALS_ID || "application-name",
      secret: process.env.TDRIVE_CREDENTIALS_SECRET || "application-secret",
  }
};

const refreshToken = async (): Promise<string> => {
  try {
    const response = await axios.post<IApiServiceApplicationTokenRequestParams, { data: IApiServiceApplicationTokenResponse }>(
      `${tdriveConfig.url.replace(/\/$/, '')}/api/console/v1/login`,
      {
        id: tdriveConfig.credentials.id,
        secret: tdriveConfig.credentials.secret,
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${tdriveConfig.credentials.id}:${tdriveConfig.credentials.secret}`).toString('base64')}`,
        },
      },
    );

    const {
      resource: {
        access_token: { value },
      },
    } = response.data;

    //axiosClient.interceptors.response.use(this.handleResponse, this.handleErrors);

    return value;
  } catch (error) {
    console.error('failed to get application token', error);
    console.info('Using token ', tdriveConfig.credentials.id, tdriveConfig.credentials.secret);
    console.info(`POST ${tdriveConfig.url.replace(/\/$/, '')}/api/console/v1/login`);
    console.info(`Basic ${Buffer.from(`${tdriveConfig.credentials.id}:${tdriveConfig.credentials.secret}`).toString('base64')}`);
    throw new Error("Unable to get access to token, see precious errors for details.");
  }
};


// Create LDAP client
const client = ldap.createClient({
  url: ldapConfig.url,
});

const accessToken = await refreshToken()

const axiosClient = axios.create({
  baseURL: tdriveConfig.url,
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
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
      attributes: [ldapConfig.mappings.firstName, ldapConfig.mappings.lastName, ldapConfig.mappings.email],
      scope: "sub",
      derefAliases: 2,
    },
    (searchErr, searchRes) => {
      if (searchErr) {
        console.error("LDAP search error:", searchErr);
        return;
      }

      const apiRequests: Promise<any>[] = [];

      searchRes.on("searchEntry", (entry: SearchEntry) => {
        console.log('Receive entry:: ' + JSON.stringify(entry.attributes));

        // Handle each search result entry
        const userAttributes: UserAttributes = {
          first_name: entry.attributes.find(a=> a.type == ldapConfig.mappings.firstName)?.vals[0]!,
          last_name: entry.attributes.find(a=> a.type == ldapConfig.mappings.lastName)?.vals[0]!,
          email: entry.attributes.find(a=> a.type == ldapConfig.mappings.email)?.vals[0]!,
        };

        if (userAttributes.email) {
          //Make API call to tdrive backend with the userAttributes
          apiRequests.push(axiosClient.post(process.env.API_URL || "", userAttributes)
            .catch((e: AxiosError<any>) => {
              console.log(`Error for ${JSON.stringify(userAttributes)}: ${e.message}, body: ${e.response?.data?.message}`);
            }));
        } else {
          console.log(`user ${JSON.stringify(userAttributes)} doesn't have an email`);
        }
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

            Promise.allSettled(apiRequests)
              .finally(() => console.log("LDAP search COMPLETED."));
          }
        });
      });
    }
  );
});
