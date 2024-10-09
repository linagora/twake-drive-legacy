import * as path from 'path';
import { static as expressStatic, Application, Router } from 'express';

import * as Utils from '@/utils';
import { SERVER_ORIGIN, SERVER_PREFIX } from '@config';

import { HealthStatusController } from '@/controllers/health-status.controller';
import { TwakeDriveBackendCallbackRoutes } from './backend-callbacks.route';
import { BrowserEditorRoutes } from './browser-editor.route';
import { OnlyOfficeRoutes } from './onlyoffice.route';

function mountAssetsRoutes(router: Router) {
  router.use(
    '/assets',
    (req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'X-Requested-With');
      next();
    },
    expressStatic(path.join(__dirname, '../../assets')),
  );
}

export function mountRoutes(app: Application) {
  // Technical routes for ops. Should not be exposed.
  app.get('/health', HealthStatusController.get);

  // These routes are forwarded through the Twake Drive front, back and here
  const proxiedRouter = Router();
  BrowserEditorRoutes.mount(proxiedRouter);
  OnlyOfficeRoutes.mount(proxiedRouter);
  mountAssetsRoutes(proxiedRouter);
  app.use(SERVER_PREFIX /* usually "plugins/onlyoffice" */, proxiedRouter);

  // These endpoints should only be accessible to the Twake Drive backend
  const apiRouter = Router();
  TwakeDriveBackendCallbackRoutes.mount(apiRouter);
  app.use('/tdriveApi/1', apiRouter);
}

export const makeURLTo = {
  rootAbsolute: () => Utils.joinURL([SERVER_ORIGIN, SERVER_PREFIX]),
  assets: () => Utils.joinURL([SERVER_PREFIX, 'assets']),
  editorAbsolute(params: {
    token: string;
    drive_file_id: string;
    file_id: string;
    editing_session_key: string;
    company_id: string;
    preview: string;
    office_token: string;
  }) {
    return Utils.joinURL([SERVER_ORIGIN ?? '', SERVER_PREFIX, 'editor'], params);
  },
};
