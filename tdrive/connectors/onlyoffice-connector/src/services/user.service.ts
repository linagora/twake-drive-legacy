import { IuserService, UserType } from '@/interfaces/user.interface';
import apiService from './api.service';
import logger from '../lib/logger';

class UserService implements IuserService {
  public getCurrentUser = async (token: string): Promise<UserType> => {
    try {
      const { resource } = await apiService.get<{ resource: UserType }>({
        url: '/internal/services/users/v1/users/me',
        token,
      });

      return resource;
    } catch (error) {
      logger.error('Failed to fetch the current user from Twake Drive', error.stack);

      return null;
    }
  };
}

export default new UserService();
