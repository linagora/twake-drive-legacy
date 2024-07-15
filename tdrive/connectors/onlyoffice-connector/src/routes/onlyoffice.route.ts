import OnlyOfficeController from '@/controllers/onlyoffice.controller';
import { Routes } from '@/interfaces/routes.interface';
import requirementsMiddleware from '@/middlewares/requirements.middleware';
import { Router } from 'express';

class OnlyOfficeRoute implements Routes {
  public path = '/';
  public router = Router();
  public onlyOfficeController: OnlyOfficeController;

  constructor() {
    this.onlyOfficeController = new OnlyOfficeController();
    this.initRoutes();
  }

  private initRoutes = () => {
    this.router.get(`${this.path}:mode/read`, requirementsMiddleware, this.onlyOfficeController.read);
    this.router.post(`${this.path}:mode/save`, requirementsMiddleware, this.onlyOfficeController.ooCallback);
  };
}

export default OnlyOfficeRoute;
