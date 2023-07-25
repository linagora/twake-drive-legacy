/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import LoginService from '@features/auth/login-service';
import UserAPIClient from '@features/users/api/user-api-client';
import { useRecoilState } from 'recoil';
import { CurrentUserState } from '../state/atoms/current-user';
import { useRealtimeRoom } from '@features/global/hooks/use-realtime';
import Languages from '@features/global/services/languages-service';
import { useSetUserList } from './use-user-list';
import { getPublicLinkToken } from 'app/features/drive/api-client/api-client';
import Logger from '../../../features/global/framework/logger-service';

export const useCurrentUser = () => {
  const [user, setUser] = useRecoilState(CurrentUserState);
  const { set: setUserList } = useSetUserList('useCurrentUser');

  const logger = Logger.getLogger('useCurrentUser');

  //Depreciated way to get use update from LoginService
  LoginService.recoilUpdateUser = setUser;

  useEffect(() => {
    if (!user && !getPublicLinkToken()) {
      logger.debug("Init LoggerService ...");
      LoginService.init(true)
        .then(() => logger.debug("Init LoggerService completed"))
        .then(() => LoginService.login({}))
        .then(() => logger.debug("Login process completed"))
        .then(() => {if (user) setUserList([user])})
        .catch(err => logger.error("Error during auth: ", err))
    } else {
      if (user) setUserList([user]);
    }
  }, [user]);

  //Update app language
  useEffect(() => {
    if (user?.preferences?.locale) Languages.setLanguage(user?.preferences?.locale);
  }, [user?.preferences?.locale]);

  const refresh = async () => {
    if (!getPublicLinkToken()) {
      await LoginService.updateUser();
    }
  };

  return { user, refresh };
};

export const useCurrentUserRealtime = () => {
  const { user, refresh } = useCurrentUser();
  const room = UserAPIClient.websocket(user?.id || '');

  const timeout = useRef(0);

  useRealtimeRoom<any>(room, 'useCurrentUser', async (action, resource) => {
    switch (resource._type) {
      case 'user':
        clearTimeout(timeout.current); //
        timeout.current = setTimeout(() => {
          refresh();
        }, 1000) as any;
        break;
      default:
        console.error('Unknown resource type');
    }
  });
};
