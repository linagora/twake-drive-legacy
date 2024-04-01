import { useRecoilState, useRecoilValue } from 'recoil';

import { useGlobalEffect } from '@features/global/hooks/use-global-effect';
import { LoadingState } from '@features/global/state/atoms/Loading';
import { UserType } from '@features/users/types/user';
import UserAPIClient from '../api/user-api-client';
import { UserSelector, UserByUsernameSelector } from '../state/selectors/user-selector';

export const useUserByUsername = (username: string): UserType | undefined => {
  const userId = useRecoilValue(UserByUsernameSelector(username));
  return useRecoilValue(UserSelector(userId || ''));
};

export const useUser = (userId: string): UserType | undefined => {
  const user = useRecoilValue(UserSelector(userId));
  const [, setLoading] = useRecoilState(LoadingState(`user-${userId}`));

  const refresh = async () => {
    setLoading(true);
    UserAPIClient.list([userId], undefined, {
      bufferize: false,
      callback: () => {
        setLoading(false);
      },
    });
  };

  useGlobalEffect(
    `use-user-${userId}`,
    () => {
      if (!user) refresh();
    },
    [],
  );

  return user;
};
