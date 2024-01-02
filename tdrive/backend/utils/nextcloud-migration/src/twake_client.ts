import axios from 'axios';
import { User } from './ldap_user';
import FormData from 'form-data';
// @ts-ignore
import fs from 'fs';
import { logger } from './logger';

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
    if (this.config && this.config.url) {
      this.config.url = this.config.url.replace(/\/$/, '');
    }
  }

  private async uploadFile(path: string) {
    logger.info(`Upload ${path}`);
    const client = await this.client();

    const form = new FormData();
    form.append('file', fs.createReadStream(path));

    const response
      = await client.post(`${this.config.url}/internal/services/files/v1/companies/00000000-0000-4000-0000-000000000000/files`, form);

    logger.info(response.data);

    return response.data?.resource;
  }

  async createFile(path: string, parent_id: string) {
    const file = await this.uploadFile(path);
    return this.createDocumentFromFile(file, parent_id);
  }

  async createDirectory(name: string, parent: string) {
    return this.createDocument({
      company_id: '00000000-0000-4000-0000-000000000000',
      name: name,
      parent_id: parent,
      is_directory: true,
    }, {});
  }

  private async createDocumentFromFile(file: any, parent_id: string) {
    const item = {
      name: file.metadata.name,
      parent_id: parent_id,
      company_id: file.company_id,
    };

    const version = {
      file_metadata: {
        name: file.metadata.name,
        size: file.upload_data?.size,
        thumbnails: [],
        external_id: file.id,
      },
    };
    return await this.createDocument(item, version);
  };

  private async createDocument(item: any, version: any) {
    const response
      = await (await this.client()).post(`${this.config.url}/internal/services/documents/v1/companies/00000000-0000-4000-0000-000000000000/item`, {
      item,
      version,
    });
    logger.info(response);
    return response.data;
  };

  async getDocument(id: string) {
    logger.info(`Get information for the doc ${id}`);
    const response
      = await (await this.client()).get(`${this.config.url}/internal/services/documents/v1/companies/00000000-0000-4000-0000-000000000000/item/${id}`, {
    });
    logger.info(response);
    return response.data;
  }

  async getUser(id: string) {
    const client = await this.client();
    try {
      let url = `${this.config.url}/internal/services/users/v1/users/${id}`;
      logger.info(`Get user company with ${url}`);
      const response = await client.get(url);
      logger.info(response.data);
      return response?.data?.resource as TwakeDriveUser;
    } catch (e) {
      logger.info(`Error for ${id}: ${e.message}, body: ${e.response?.data?.message}`);
      throw e;
    }
  }

  async createUser(user: User): Promise<TwakeDriveUser> {
    const client = await this.client();
    try {
      const response = await client.post(this.config.url + '/api/sync',
        {
          first_name: user.firstName,
          last_name: user.lastName,
          email: user.email,
        });
      return response.data as TwakeDriveUser;
    } catch (e) {
      logger.info(`Error for ${JSON.stringify(user)}: ${e.message}, body: ${e.response?.data?.message}`);
      throw e;
    }
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
      throw new Error('Unable to get access to token, see precious errors for details.');
    }
  };

}

export type TwakeDriveUser = {
  first_name: string;
  last_name: string;
  email: string;
  id: string,
  email_canonical: string,
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