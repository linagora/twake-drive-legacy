import Logger from '@features/global/framework/logger-service';
import { InternalConfiguration } from '../../../global/services/init-service';
import Observable from '../../../../deprecated/Observable/Observable';
import { TdriveService } from '../../../global/framework/registry-decorator-service';
import { AuthProvider, InitParameters } from '../auth-provider';
import Globals from '@features/global/services/globals-tdrive-app-service';
import RouterService from '@features/router/services/router-service';
import ConsoleAPIClient from '@features/console/api/console-api-client';

export type SignInParameters = {
  username: string;
  password: string;
  remember_me: boolean;
};

export type SignUpParameters = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  username: string;
};

export type SignOutParameters = {
  reload: boolean;
};

@TdriveService('InternalAuthProvider')
export default class InternalAuthProviderService
  extends Observable
  implements AuthProvider<SignInParameters, SignOutParameters, SignUpParameters>
{
  private logger: Logger.Logger;
  private initialized = false;
  private signinIn = false;
  private params?: InitParameters;

  constructor(private configuration?: InternalConfiguration) {
    super();
    this.logger = Logger.getLogger('InternalAuthProvider');
    this.logger.debug('Internal configuration', configuration);
  }

  init(params: InitParameters): this {
    if (this.initialized) {
      this.logger.warn('Already initialized');
      return this;
    }
    this.params = params;

    this.initialized = true;
    params.onInitialized();
    return this;
  }

  async signIn(params: SignInParameters): Promise<void> {
    if (!params.username || !params.password) {
      return Promise.reject('"username" and "password" are required');
    }

    this.signinIn = true;
    this.logger.log("Sign in in console");
    try {
      const access_token = await ConsoleAPIClient.login(
        {
          email: params.username,
          password: params.password,
          remember_me: params.remember_me,
        },
        true,
      );
      this.logger.debug("Got access token from server");
      await this.params?.onNewToken(access_token);
      this.signinIn = true;
    } catch (e) {
      this.signinIn = false;
      throw new Error('Can not login');
    } finally {
      this.signinIn = false;
    }

  }

  async signOut(params: SignOutParameters): Promise<void> {
    const notOnLogoutRoute = window.location.pathname !== '/logout';

    if (params.reload && notOnLogoutRoute) {
      Globals.window.location.reload();
    } else {
      Globals.window.location.assign(
        `${RouterService.pathnames.LOGIN}${RouterService.history.location.search}`,
      );
    }
  }

  async signUp(params: SignUpParameters) {
    await ConsoleAPIClient.signup(params);
  }
}
