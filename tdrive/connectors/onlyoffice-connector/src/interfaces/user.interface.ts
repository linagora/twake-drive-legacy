export type UserType = {
  id: string;
  username: string;
  thumbnail: string;
  picture: string;
  email: string;
  preferences: {
    locale: string;
  };
};

export interface IuserService {
  getCurrentUser: (token: string) => Promise<UserType>;
}
