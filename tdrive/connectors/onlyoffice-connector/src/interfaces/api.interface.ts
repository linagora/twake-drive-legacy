import { ResponseType } from 'axios';

export interface IApiServiceRequestParams<T> {
  url: string;
  payload?: T;
  token?: string;
  responseType?: ResponseType;
  headers?: any;
}

export interface IApiService {
  get<T>(params: IApiServiceRequestParams<T>): Promise<T>;
  post<T>(params: IApiServiceRequestParams<T>): Promise<T>;
  runCommand<T>(c: string, key: string): Promise<void>;
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
