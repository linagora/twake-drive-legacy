import Api from '@features/global/framework/api-service';
import { TdriveService } from '@features/global/framework/registry-decorator-service';
import JWTStorage, { JWTDataType } from '@features/auth/jwt-storage-service';
import Logger from "features/global/framework/logger-service";

type LoginParams = {
  email: string;
  password: string;
  remember_me: boolean;
};

type SignupParams = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  username: string;
};

type AccessTokenResponse = {
  statusCode: string;
  access_token: JWTDataType;
}

type AccessTokenRequest = {
  oidc_id_token: string;
}

@TdriveService('ConsoleAPIClientService')
class ConsoleAPIClient {

  logger = Logger.getLogger('ConsoleAPIClient');

  login(params: LoginParams, disableJWTAuthentication = false): Promise<string> {
    return Api.post<LoginParams, { access_token: string }>(
      '/internal/services/console/v1/login',
      { ...params, ...{ device: {} } },
      undefined,
      false,
      { disableJWTAuthentication },
    ).then(res => res.access_token);
  }

  async signup(params: SignupParams) {
    const res = await Api.post<SignupParams, { error?: string }>(
      '/internal/services/console/v1/signup',
      params,
    );
    if (res.error) {
      throw new Error(res.error);
    }
    return res;
  }

  public async getNewAccessToken(
    currentToken: { access_token: string; id_token: string }
  ): Promise<JWTDataType> {
    this.logger.debug(
      `getNewAccessToken, get new token from current token ${JSON.stringify(currentToken)}`,
    );
    const response = await Api.post<AccessTokenRequest, AccessTokenResponse>(
      '/internal/services/console/v1/login',
      { oidc_id_token: currentToken.id_token });

    if (response.statusCode && !response.access_token) {
      this.logger.error(
        'getNewAccessToken, Can not retrieve access_token from console. Response was',
        response,
      );
      throw new Error('Can not retrieve access_token from console');
    }
    // the input access_token is potentially expired and so the response contains an error.
    // we should be able to refresh the token or renew it in some way...
    return response.access_token;
  }

  renewAccessToken(): Promise<JWTDataType> {
    if (JWTStorage.isRefreshExpired() && JWTStorage.isAccessExpired()) {
      throw new Error('Can not get access token as both access and refresh token are expired');
    }
    return new Promise<JWTDataType>((resolve, reject) => {
      Api.post<
        undefined,
        { access_token: JWTDataType; message: string; error: string; statusCode: number }
      >('/internal/services/console/v1/token', undefined, response => {
        if (JWTStorage.isRefreshExpired() && JWTStorage.isAccessExpired()) {
          reject(new Error('Can not get access token'));
          return;
        }
        response.access_token
          ? resolve(response.access_token)
          : reject(new Error('Can not get access token'));
      });
    });
  }
}

export default new ConsoleAPIClient();
