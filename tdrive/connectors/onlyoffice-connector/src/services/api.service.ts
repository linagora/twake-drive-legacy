import {
  IApiServiceRequestParams,
  IApiService,
  IApiServiceApplicationTokenRequestParams,
  IApiServiceApplicationTokenResponse,
} from '@/interfaces/api.interface';
import axios, { Axios, AxiosRequestConfig, AxiosResponse } from 'axios';
import { CREDENTIALS_ENDPOINT, CREDENTIALS_ID, CREDENTIALS_SECRET, ONLY_OFFICE_SERVER } from '@config';
import loggerService from './logger.service';
import * as Utils from '@/utils';

/** Client for the Twake Drive backend API on behalf of the plugin (or provided token in parameters) */
class ApiService implements IApiService {
  private axios: Axios;
  private initialized: Promise<string>;

  constructor() {
    this.initialized = this.refreshToken();
    this.initialized.catch(error => {
      loggerService.error('failed to init API', error);
    });

    setInterval(() => {
      this.initialized = this.refreshToken();
      loggerService.info('Refreshing token 🪙');
    }, 1000 * 60); //TODO: should be Every 10 minutes
  }

  public get = async <T>(params: IApiServiceRequestParams<T>): Promise<T> => {
    const { url, token, responseType, headers } = params;

    await this.initialized;

    const config: AxiosRequestConfig = {};

    if (token) {
      config['headers'] = {
        Authorization: `Bearer ${token}`,
        ...headers,
      };
    }

    if (responseType) {
      config['responseType'] = responseType;
    }

    return await this.axios.get(url, config);
  };

  public post = async <T, R>(params: IApiServiceRequestParams<T>): Promise<R> => {
    const { url, payload, headers } = params;

    await this.initialized;
    try {
      return await this.axios.post(url, payload, {
        headers: {
          ...headers,
        },
      });
    } catch (error) {
      loggerService.error('Failed to post: ', error.message);
      this.refreshToken();
    }
  };

  private handleErrors = (error: any): Promise<any> => {
    loggerService.error('Failed Request', error.message);

    return Promise.reject(error);
  };

  private handleResponse = <T>({ data }: AxiosResponse): T => data;

  private refreshToken = async (): Promise<string> => {
    try {
      const response = await axios.post<IApiServiceApplicationTokenRequestParams, { data: IApiServiceApplicationTokenResponse }>(
        Utils.joinURL([CREDENTIALS_ENDPOINT, '/api/console/v1/login']),
        {
          id: CREDENTIALS_ID,
          secret: CREDENTIALS_SECRET,
        },
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${CREDENTIALS_ID}:${CREDENTIALS_SECRET}`).toString('base64')}`,
          },
        },
      );

      const {
        resource: {
          access_token: { value },
        },
      } = response.data;

      this.axios = axios.create({
        baseURL: CREDENTIALS_ENDPOINT,
        headers: {
          Authorization: `Bearer ${value}`,
        },
      });

      this.axios.interceptors.response.use(this.handleResponse, this.handleErrors);

      return value;
    } catch (error) {
      loggerService.error('failed to get application token', error.message);
      loggerService.info('Using token ', CREDENTIALS_ID, CREDENTIALS_SECRET);
      loggerService.info(`POST ${CREDENTIALS_ENDPOINT.replace(/\/$/, '')}/api/console/v1/login`);
      loggerService.info(`Basic ${Buffer.from(`${CREDENTIALS_ID}:${CREDENTIALS_SECRET}`).toString('base64')}`);
      throw Error(error);
    }
  };

}

export default new ApiService();
