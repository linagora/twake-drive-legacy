import {
  IApiServiceRequestParams,
  IApiService,
  IApiServiceApplicationTokenRequestParams,
  IApiServiceApplicationTokenResponse,
} from '@/interfaces/api.interface';
import axios, { Axios, AxiosRequestConfig, AxiosResponse } from 'axios';
import { CREDENTIALS_ENDPOINT, CREDENTIALS_ID, CREDENTIALS_SECRET, twakeDriveTokenRefrehPeriodMS } from '@config';
import logger from '../lib/logger';
import * as Utils from '@/utils';
import { PolledThingieValue } from '@/lib/polled-thingie-value';
import { IHealthProvider, registerHealthProvider } from './health-providers.service';

/**
 * Client for the Twake Drive backend API on behalf of the plugin (or provided token in parameters).
 * Periodically updates authorization and adds to requests.
 */
class ApiService implements IApiService, IHealthProvider {
  private readonly tokenPoller: PolledThingieValue<Axios>;

  constructor() {
    this.tokenPoller = new PolledThingieValue('Refresh Twake Drive token', async () => await this.refreshToken(), twakeDriveTokenRefrehPeriodMS);
    registerHealthProvider(this);
  }

  public async hasToken() {
    return (await this.tokenPoller.latestValueWithTry()) !== undefined;
  }

  async getHealthData() {
    return { TwakeDriveApi: { tokenAgeS: this.tokenPoller.latest()?.ageS ?? -1 } };
  }

  private requireAxios() {
    return this.tokenPoller.requireLatestValueWithTry('No Twake Drive app token.');
  }

  public get = async <T>(params: IApiServiceRequestParams<T>): Promise<T> => {
    const { url, token, responseType, headers } = params;

    const axiosWithToken = await this.requireAxios();

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
    return await axiosWithToken.get(url, config);
  };

  public delete = async <T>(params: IApiServiceRequestParams<T>): Promise<T> => {
    const { url, token, responseType, headers } = params;

    const axiosWithToken = await this.requireAxios();

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
    return await axiosWithToken.delete(url, config);
  };

  public post = async <T, R>(params: IApiServiceRequestParams<T>): Promise<R> => {
    const { url, token, payload, headers } = params;

    const axiosWithToken = await this.requireAxios();

    logger.info(`POST to Twake Drive ${url} - payload: ${payload}`);
    try {
      return await axiosWithToken.post(url, payload, {
        headers: {
          ...headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (error) {
      logger.error('Failed to post to Twake Drive: ', { error: error.stack });
      this.refreshToken();
      throw error;
    }
  };

  private handleErrors = (error: any): Promise<any> => {
    logger.error('Failed Request to Twake drive', error.stack);

    return Promise.reject(error);
  };

  private handleResponse = <T>({ data }: AxiosResponse): T => data;

  private refreshToken = async (): Promise<Axios> => {
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

      const axiosWithToken = axios.create({
        baseURL: CREDENTIALS_ENDPOINT,
        headers: {
          Authorization: `Bearer ${value}`,
        },
      });

      axiosWithToken.interceptors.response.use(this.handleResponse, this.handleErrors);

      return axiosWithToken;
    } catch (error) {
      logger.error('failed to get application token from Twake drive', error.stack);
      logger.info('Using token ', CREDENTIALS_ID, CREDENTIALS_SECRET);
      logger.info(`POST ${CREDENTIALS_ENDPOINT.replace(/\/$/, '')}/api/console/v1/login`);
      logger.info(`Basic ${Buffer.from(`${CREDENTIALS_ID}:${CREDENTIALS_SECRET}`).toString('base64')}`);
      throw Error(error);
    }
  };
}

export default new ApiService();
