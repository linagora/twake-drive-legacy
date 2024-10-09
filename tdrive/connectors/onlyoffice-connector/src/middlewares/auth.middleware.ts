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

    const authHeaderToken = req.header('authorization');
    try {
      if (authHeaderToken) {
        const fromTwakeDriveToken = jwt.verify(authHeaderToken, CREDENTIALS_SECRET) as Record<string, string>;
        // The following constant comes from tdrive/backend/node/src/services/applications-api/index.ts
        // This is in the case when Twake Drive backend makes requests from the connector,
        // but not on the behalf of a specific user, eg. when checking stale only office keys
        if (fromTwakeDriveToken['type'] != 'tdriveToApplication') throw new Error(`Bad type in token ${JSON.stringify(fromTwakeDriveToken)}`);
        return next();
      }
    } catch (e) {
      logger.error(`Invalid token in Authorization header from Twake Drive backend`, e);
      return res.status(401).json({ message: 'invalid token' });
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
