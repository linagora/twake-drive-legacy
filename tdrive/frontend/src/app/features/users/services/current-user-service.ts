/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Login from '@features/auth/login-service';
import Collections, { Collection } from '@deprecated/CollectionsV1/Collections/Collections';
import Api from '@features/global/framework/api-service';
import Languages from '@features/global/services/languages-service';
import { UserType } from '@features/users/types/user';
import { TdriveService } from '@features/global/framework/registry-decorator-service';
import { addApiUrlIfNeeded } from '@features/global/utils/URLUtils';
import { getUser } from '../hooks/use-user-list';
import { getGradient } from '@atoms/avatar';

type SearchQueryType = {
  searching: boolean;
  previous: string;
  current: string;
  timeout_search?: ReturnType<typeof setTimeout>;
};

@TdriveService('UserServiceImpl')
class User {
  private users_repository: Collection;
  private searchQueries: SearchQueryType;

  constructor() {
    this.users_repository = Collections.get('users');
    Collections.updateOptions('users', { base_url: 'users', use_cache: true });
    this.searchQueries = {
      searching: false,
      previous: '',
      current: '',
    };
  }

  getCurrentUser(): UserType & { id: string } {
    return getUser(Login.currentUserId) as UserType & { id: string };
  }

  getCurrentUserId(): string {
    return Login.currentUserId;
  }

  getFullName(user: Pick<UserType, 'username' | 'first_name' | 'last_name' | 'deleted'>): string {
    let name: string = user?.username;

    if (!name) {
      return 'Anonymous';
    }
    // @author https://stackoverflow.com/a/17200679
    const toNameCase = (str?: string) => (str || '').toLowerCase().replace(/(?<!\p{L})\p{L}(?=\p{L}{2})/gu, (m: string) => m.toUpperCase());

    if (user.deleted) {
      name = Languages.t('general.user.deleted');
    } else {
      name = [user.first_name, user.last_name].filter(a => a).map(toNameCase).join(' ');
      name = name || user.username;
    }

    return name;
  }

  getThumbnail(user: UserType) {
    let thumbnail = '';

    if (!user) {
      return thumbnail;
    }

    if (user && (user.thumbnail || user.picture)) {
      thumbnail = addApiUrlIfNeeded(user.picture || user.thumbnail || '');
    } else {
      //Generate gradient thumbnail
      //TODO: move me to backend ?
      thumbnail = getGradient(user.username);
    }

    if (user.deleted) {
      thumbnail = '';
    }

    return thumbnail;
  }

  search(
    query = '',
    options: { scope: string; workspace_id: string; group_id: string },
    callback: (users: UserType[]) => void = () => {},
    noHttp?: boolean,
    didTimeout?: boolean,
  ) {
    const scope = options.scope;

    if (query === 'me') {
      query = this.getCurrentUser().username;
    }

    this.searchQueries.current = query;

    if (query.length === 0) {
      callback([]);
      return;
    }

    //First search with known data
    const res: UserType[] = [];
    Collections.get('users')
      .findBy({})
      .forEach((user: UserType) => {
        if (
          `${user.username} ${user.first_name} ${user.last_name} ${user.email}`
            .toLocaleLowerCase()
            .indexOf(query.toLocaleLowerCase()) >= 0
        ) {
          let in_scope = true;
          if (scope === 'workspace') {
            in_scope = (user.workspaces_id || []).indexOf(options.workspace_id) >= 0;
          }
          if (scope === 'group') {
            in_scope = (user.groups_id || []).indexOf(options.group_id) >= 0;
          }
          if (in_scope) {
            res.push(user);
          }
        }
        if (res.length > 30) {
          return false;
        }
      });

    callback(res);

    if (res.length > 5) {
      return;
    }

    //Then search on server
    if (noHttp || query.length < 2 || (this.searchQueries.previous || '').startsWith(query)) {
      this.searchQueries.previous = query;
      return;
    }
    this.searchQueries.previous = query;

    if (this.searchQueries.timeout_search) {
      clearTimeout(this.searchQueries.timeout_search);
    }
    if (this.searchQueries.searching) {
      this.searchQueries.timeout_search = setTimeout(() => {
        this.search(query, options, callback, false, true);
      }, 1000);
      return;
    }

    this.searchQueries.searching = true;
    setTimeout(
      () => {
        Api.post(
          '/ajax/users/all/search',
          {
            options: {
              scope: scope,
              name: query,
              workspace_id: options.workspace_id,
              group_id: options.group_id,
              language_preference: this.getCurrentUser().language,
            },
          },
          (res: { [key: string]: any }) => {
            this.searchQueries.searching = false;
            if (res.data && res.data.users) {
              res.data.users.forEach((item: any) => {
                this.users_repository.updateObject(item[0], null);
              });
              this.search(query, options, callback, true, true);
            }
          },
        );
      },
      didTimeout ? 0 : 1000,
    );
  }

  // member - guest - admin - unknown
  getUserRole(user: any, companyId?: string) {
    const currentUserCompany = (user?.companies || []).filter(
      (item: any) => item.company.id === companyId,
    )[0];

    return currentUserCompany?.role || 'unknown';
  }

  isInCompany(user: UserType, companyId?: string) {
    return user.cache?.companies?.find(company => company == companyId) !== undefined;
  }
}

export default new User();
