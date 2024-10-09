import BrowserEditorController from '@/controllers/browser-editor.controller';
import authMiddleware from '@/middlewares/auth.middleware';
import requirementsMiddleware from '@/middlewares/requirements.middleware';
import type { Router } from 'express';

/**
 * When the user previews or edits a file in Twake Drive, their browser is sent to these routes
 * which return a webpage that instantiates the client side JS Only Office component.
 */
export const BrowserEditorRoutes = {
  mount(router: Router) {
    const controller = new BrowserEditorController();
    router.get('/', requirementsMiddleware, authMiddleware, controller.index.bind(controller));
    router.get('/editor', requirementsMiddleware, authMiddleware, controller.editor.bind(controller));
  },
};
