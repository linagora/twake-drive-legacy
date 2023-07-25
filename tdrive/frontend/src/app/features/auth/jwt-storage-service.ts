/* eslint-disable @typescript-eslint/no-explicit-any */
import LocalStorage from '@features/global/framework/local-storage-service';
import LoginService from '@features/auth/login-service';
import WindowService from '@features/global/utils/window';
import ConsoleAPIClient from '@features/console/api/console-api-client';
import { TdriveService } from '../global/framework/registry-decorator-service';
import Logger from '../global/framework/logger-service';

export type JWTDataType = {
  time: 0;
  expiration: number;
  refresh_expiration: number;
  value: string;
  refresh: string;
  type: 'Bearer';
};

//Mobile temporary
if ((WindowService.findGetParameter('mobile_login') as any) === '1') {
  LocalStorage.setItem('mobile_login', '1');
}

@TdriveService('JWTStorageService')
class JWTStorage {
  private timeDelta = 5 * 60;
  private jwtData: JWTDataType = {
    time: 0,
    expiration: 0,
    refresh_expiration: 0,
    value: '',
    refresh: '',
    type: 'Bearer',
  };
  logger: Logger.Logger;

  constructor() {
    this.logger = Logger.getLogger('JWT');
    this.init();

    setInterval(() => {
      if (this.jwtData.value && this.jwtData.expiration < new Date().getTime() + 1000 * 60 * 10) {
        this.renew().catch(async () => {
          if (await LoginService.pingServer()) (window as any).document.location.reload();
        });
      }
    }, 60000);
  }

  private init() {
    this.updateJWT(LocalStorage.getItem<JWTDataType>('jwt') as JWTDataType, {
      fromLocalStorage: true,
    });
  }

  clear() {
    this.jwtData = {
      time: 0,
      expiration: 0,
      refresh_expiration: 0,
      value: '',
      refresh: '',
      type: 'Bearer',
    };
    LocalStorage.setItem('jwt', null);
  }

  updateJWT(jwtData: JWTDataType, options?: { fromLocalStorage: boolean }) {
    if (!jwtData) {
      return;
    }

    //Mobile temporary
    const mobileLogin = LocalStorage.getItem<string>('mobile_login');

    LocalStorage.setItem('mobile_login', '0');
    if (mobileLogin === '1') {
      document.location.replace(
        '/internal/mobile/login/redirect?jwt=' + encodeURI(JSON.stringify(jwtData)),
      );
    }

    this.jwtData = jwtData;
    if (!options?.fromLocalStorage) {
      this.timeDelta = new Date().getTime() / 1000 - jwtData.time;
      this.jwtData.expiration += this.timeDelta - 5 * 60; //Force reduce expiration by 5 minutes
      this.jwtData.refresh_expiration += this.timeDelta - 5 * 60; //Force reduce expiration by 5 minutes
      this.logger.info("Update jwt token in local storage")
      LocalStorage.setItem('jwt', this.jwtData);
    }
  }

  getJWT() {
    return this.jwtData.value;
  }

  getAutorizationHeader() {
    let value = this.jwtData.value;
    if (this.isAccessExpired()) {
      value = this.jwtData.refresh;
    }
    return `${this.jwtData.type} ${value}`;
  }

  isAccessExpired() {
    if (!this.jwtData?.expiration) return true;

    const expired = new Date().getTime() / 1000 - this.jwtData.expiration > 0;

    expired &&
      this.logger.debug(`Access token expired, expiration time was ${this.jwtData.expiration}`);

    return expired;
  }

  isRefreshExpired() {
    if (!this.jwtData?.expiration) return true;

    const expired = new Date().getTime() / 1000 - this.jwtData.refresh_expiration > 0;

    expired &&
      this.logger.debug(
        `Refresh token expired, expiration time was ${this.jwtData.refresh_expiration}`,
      );

    return expired;
  }

  authenticateCall(callback?: () => void) {
    if (
      this.isAccessExpired() &&
      LoginService.currentUserId &&
      !document.location.pathname.includes('/shared/')
    ) {
      this.logger.debug('authenticateCall: Updating user because the access token expired');
      this.renew()
        .then(() => {
          LoginService.updateUser(callback);
        })
        .catch(async () => {
          this.clear();
          if (await LoginService.pingServer()) (window as any).document.location.reload();
        });
      return;
    }

    callback && callback();
  }

  async renew(): Promise<JWTDataType> {
    const token = await ConsoleAPIClient.renewAccessToken();

    if (!token) {
      throw new Error('Can not get a new access token');
    }

    this.updateJWT(token);

    return token;
  }
}

export default new JWTStorage();
