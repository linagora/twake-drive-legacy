import IndexController from '@/controllers/index.controller';
import { Routes } from '@/interfaces/routes.interface';
import authMiddleware from '@/middlewares/auth.middleware';
import requirementsMiddleware from '@/middlewares/requirements.middleware';
import { Router } from 'express';

class IndexRoute implements Routes {
  public path = '/';
  public router = Router();
  public indexController: IndexController;

  constructor() {
    this.indexController = new IndexController();
    this.initRoutes();
  }

  private initRoutes = () => {
    this.router.get(this.path, requirementsMiddleware, authMiddleware, this.indexController.index);
    this.router.get(this.path + 'editor', requirementsMiddleware, authMiddleware, this.indexController.editor);
  };
}

export default IndexRoute;
