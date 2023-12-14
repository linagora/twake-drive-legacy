import axios, { AxiosError } from 'axios';
import { User } from './ldap_user';

type TwakeClientConfiguration = {
  url: string,
    credentials: {
    appId: string,
    secret: string,
  }
}


export class TwakeDriveClient {

  private config: TwakeClientConfiguration;

  constructor(config: TwakeClientConfiguration) {
    this.config = config;
    //remove the trailing '/'
    this.config.url = this.config.url.replace(/\/$/, '');
  }

  async createUser(user: User) {
    const client = await this.client();
    try {
      const response = await client.post(this.config.url + "/api/sync",
        {
          first_name: user.firstName,
          last_name: user.lastName,
          email: user.email
        });
      return response.data;
    } catch(e){
      console.log(`Error for ${JSON.stringify(user)}: ${e.message}, body: ${e.response?.data?.message}`);
      throw e;
    };
  }

  private async client() {
    return axios.create({
      baseURL: this.config.url,
      headers: {
        Authorization: `Bearer ${await (this.accessToken())}`,
      },
    });
  }

  private async accessToken(): Promise<string> {
    try {
      const response = await axios.post<IApiServiceApplicationTokenRequestParams, { data: IApiServiceApplicationTokenResponse }>(
        `${this.config.url}/api/console/v1/login`,
        {
          id: this.config.credentials.appId,
          secret: this.config.credentials.secret,
        },
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.config.credentials.appId}:${this.config.credentials.secret}`).toString('base64')}`,
          },
        },
      );

      const {
        resource: {
          access_token: { value },
        },
      } = response.data;

      return value;
    } catch (error) {
      console.error('failed to get application token', error);
      console.info('Using token ', this.config.credentials.appId, this.config.credentials.secret);
      console.info(`POST ${this.config.url}/api/console/v1/login`);
      console.info(`Basic ${Buffer.from(`${this.config.credentials.appId}:${this.config.credentials.secret}`).toString('base64')}`);
      throw new Error("Unable to get access to token, see precious errors for details.");
    }
  };

}

type TwakeDriveUser = {
  first_name: string;
  last_name: string;
  email: string;
}

interface IApiServiceApplicationTokenRequestParams {
  id: string;
  secret: string;
}

interface IApiServiceApplicationTokenResponse {
  resource: {
    access_token: {
      time: number;
      expiration: number;
      value: string;
      type: string;
    };
  };
}