import { IuserService, UserType } from '@/interfaces/user.interface';
import apiService from './api.service';
import loggerService from './logger.service';

class UserService implements IuserService {
  public getCurrentUser = async (token: string): Promise<UserType> => {
    try {
      const { resource } = await apiService.get<{ resource: UserType }>({
        url: '/internal/services/users/v1/users/me',
        token,
      });

      return resource;
    } catch (error) {
      loggerService.error('Failed to fetch the current user', error.message);

      return null;
    }
  };
}

export default new UserService();
