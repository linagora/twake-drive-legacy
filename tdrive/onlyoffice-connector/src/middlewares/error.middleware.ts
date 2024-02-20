import loggerService from '@/services/logger.service';
import { NextFunction, Request, Response } from 'express';

export default (error: Error & { status?: number }, req: Request, res: Response, next: NextFunction): void => {
  try {
    const status: number = error.status || 500;
    const message: string = error.message || 'something went wrong';

    loggerService.error(`[${req.method}] ${req.path} >> StatusCode:: ${status}, Message:: ${message}`);

    res.status(status).json({ message });
  } catch (error) {
    next(error);
  }
};
