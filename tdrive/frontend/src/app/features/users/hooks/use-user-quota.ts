import { useCallback, useEffect } from "react";
import { UserQuota } from '@features/users/types/user-quota';
import UserAPIClient from '@features/users/api/user-api-client';
import { useCurrentUser } from "features/users/hooks/use-current-user";
import { atom, useRecoilState } from "recoil";

export const QuotaState = atom<UserQuota>({
  key: 'QuotaState',
  default: {
    used: 0,
    remaining: 1,
    total: 1
  },
});

export const useUserQuota = () => {
  const nullQuota = {
    used: 0,
    remaining: 1,
    total: 1
  }
  const {user } = useCurrentUser();
  const [quota, setQuota] = useRecoilState(QuotaState);

  const getQuota = useCallback(async () => {
    let data: UserQuota = nullQuota;
    if (user?.id) {
      data = await UserAPIClient.getQuota(user.id);
    } else {
      data = nullQuota;
    }
    setQuota(data)
  },  []);

  useEffect(() => {
    getQuota();
  }, []);


  return { quota, getQuota };
};
