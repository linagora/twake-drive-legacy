import { UserType } from 'app/features/users/types/user';
import Logger from 'app/features/global/framework/logger-service';
import AccessRightsService from 'app/features/workspace-members/services/workspace-members-access-rights-service';
import CurrentUser from 'app/deprecated/user/CurrentUser';
import JWT from 'app/features/auth/jwt-storage-service';
import LocalStorage from '../../global/framework/local-storage-service';
import WebSocket from '../../global/types/websocket-types';

class Application {
  private logger: Logger.Logger;
  private started = false;

  constructor() {
    this.logger = Logger.getLogger('Application');
  }

  /**
   * Start the Tdrive application: Starting all the required services for the given user
   */
  async start(user: UserType): Promise<void> {
    if (this.started) {
      this.logger.info('Application is already started');
      return;
    }
    this.started = true;
    this.logger.info('Starting application for user', user);

    /*const ws = WebSocket.get();
    ws.connect();*/

    AccessRightsService.resetLevels();
    CurrentUser.start();
  }

  stop(): void {
    LocalStorage.clear();
    JWT.clear();
  }
}

export default new Application();
