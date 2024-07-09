import { CREDENTIALS_SECRET } from '@/config';
import logger from '@/lib/logger';
import userService from '@/services/user.service';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

interface RequestQuery {
  mode: string;
  company_id: string;
  preview: string;
  token: string;
  file_id: string;
}

export default async (req: Request<{}, {}, {}, RequestQuery>, res: Response, next: NextFunction) => {
  try {
    const token = req.query?.token;

    if (!token && req.cookies.token) {
      try {
        const userJwt = jwt.verify(req.cookies.token, CREDENTIALS_SECRET) as any;
        if (userJwt.id) {
          req.user = userJwt;
          next();
          return;
        }
      } catch (error) {
        logger.error('invalid token', error.stack);
        res.clearCookie('token');
      }
    }

    if (!token) {
      return res.status(401).send({ message: 'invalid token' });
    }

    const user = await userService.getCurrentUser(token);

    if (!user || !user.id) {
      return res.status(401).json({ message: 'invalid token' });
    }

    res.cookie(
      'token',
      jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          thumbnail: user.thumbnail,
          picture: user.picture,
          preferences: {
            locale: user?.preferences?.locale,
          },
        },
        CREDENTIALS_SECRET,
        {
          expiresIn: 60 * 60 * 24 * 30,
        },
      ),
      { maxAge: 60 * 60 * 24 * 30 },
    );

    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: 'invalid token' });
  }
};
