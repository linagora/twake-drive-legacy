import OnlyOfficeController from '@/controllers/onlyoffice.controller';
import requirementsMiddleware from '@/middlewares/requirements.middleware';
import type { Router } from 'express';

/**
 * These routes are called by the Only Office server
 * when reading a document or updating an editing session
 */
export const OnlyOfficeRoutes = {
  mount(router: Router) {
    const controller = new OnlyOfficeController();
    router.get(`/:mode/read`, requirementsMiddleware, controller.read.bind(controller));
    router.post(`/:mode/callback`, requirementsMiddleware, controller.ooCallback.bind(controller));
    router.post(`/:mode/rename`, requirementsMiddleware, controller.rename.bind(controller));
  },
};
