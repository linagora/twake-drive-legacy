import { useEffect, useState } from 'react';
import useRouterCompany from '@features/router/hooks/use-router-company';
import { UserType } from '@features/users/types/user';
import UserAPIClient from '@features/users/api/user-api-client';

export const useUserCompanyList = (): UserType[] => {
  const companyId = useRouterCompany();
  const [users, setUsers] = useState<UserType[]>([]);
  const refresh = async () => {
    const updatedData = await UserAPIClient.all(companyId);
    setUsers(updatedData);
  };
  useEffect(() => {
    refresh();
  }, []);
  return users;
};
