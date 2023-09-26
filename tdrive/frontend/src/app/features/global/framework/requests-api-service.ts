/* eslint-disable @typescript-eslint/no-explicit-any */
import JWTStorage from '@features/auth/jwt-storage-service';
import Logger from './logger-service';

class Requests {
  logger: Logger.Logger;

  constructor() {
    this.logger = Logger.getLogger('HTTPRequest');
  }

  request(
    type: 'post' | 'get' | 'put' | 'delete',
    route: string,
    data: string,
    callback: (result: string | any) => void,
    options: { disableJWTAuthentication?: boolean; withBlob?: boolean } = {},
  ) {
    this.logger.trace(`${type} ${route}`);
    if (options?.disableJWTAuthentication) {
      fetch(route, {
        credentials: 'same-origin',
        method: type,
        headers: {
          Accept: 'application/json',
          ...(data ? { 'Content-Type': 'application/json' } : {}),
          Authorization: JWTStorage.getAutorizationHeader(),
        },
        body: type === 'post' ? data || '{}' : undefined,
      })
        .then(response => {
          if (options.withBlob) {
            response.blob().then(blob => {
              callback && callback(blob);
            });
          } else {
            response.text().then(text => {
              callback && callback(text);
            });
          }
        })
        .catch(err => {
          this.logger.error('Error while sending HTTP request', err);
          callback && callback(JSON.stringify({ errors: [err] }));
        });
      return;
    }

    JWTStorage.authenticateCall(() => {
      options = options || {};
      options.disableJWTAuthentication = true;
      this.request(type, route, data, callback, options);
    });
  }
}

export default new Requests();
