/* eslint-disable @typescript-eslint/no-explicit-any */
import { createBrowserHistory, History } from 'history';
import { matchPath, match } from 'react-router';
import short, { Translator } from 'short-uuid';

import App from '@views/client/app';
import Login from '@views/login/login';
import Logout from '@views/login/logout';
import Error from '@views/error';
import Join from '@views/join';
import PublicMainView from '@views/client/body/drive/shared';
import Observable from '../../../deprecated/Observable/Observable';
import { getWorkspacesByCompany } from '@features/workspaces/state/workspace-list';

export type RouteType = {
  path: string;
  exact?: boolean | false;
  key?: string;
  routes?: RouteType[];
  component?: any;
  options?: {
    withErrorBoundary?: boolean;
  };
};

export type ClientStateType = {
  companyId?: string;
  viewId?: string;
  itemId?: string;
  dirId?: string;
  workspaceId?: string;
  channelId?: string;
  messageId?: string;
  threadId?: string;
  tabId?: string;
  directoryId?: string;
  appName?: string;
};

export type Pathnames = {
  [key: string]: string;
};

class RouterServices extends Observable {
  public translator: Translator = short();
  public history: History<unknown> = createBrowserHistory();
  public match = (pathSchema: string): match<object> | null =>
    matchPath(this.history.location.pathname, { path: pathSchema });
  public setRecoilState: (state: ClientStateType) => void = () => undefined;

  //List of client sub paths
  clientSubPathnames: Readonly<string[]> = [
    '/client/:companyId',
    '/client/:companyId/v/:viewId',
    '/client/:companyId/v/:viewId/d/:dirId',
    '/client/:companyId/v/:viewId/preview/:itemId',
    '/client/:companyId/v/:viewId/d/:dirId/preview/:itemId',
    '/client/:companyId/w/:workspaceId',
    '/client/:companyId/w/:workspaceId/c/:channelId',
    '/client/:companyId/w/:workspaceId/c/:channelId/t/:threadId',
    '/client/:companyId/w/:workspaceId/c/:channelId/m/:messageId',
    '/client/:companyId/w/:workspaceId/c/:channelId/tab/:tabId/',
    '/client/:companyId/w/:workspaceId/c/:channelId/t/:threadId/m/:messageId',
  ];

  private allowedQueryParameters: Record<string, Map<string, string>> = {
    '/client/:companyId/w/:workspaceId/c/:channelId': new Map<string, string>([['m', 'messageId']]),
  };

  pathnames: Readonly<Pathnames> = {
    CLIENT: '/client',
    SHARED_WITH_ME: '/client/:companyId/shared-with-me',
    SHARED: '/shared/:companyId/:appName/:documentId/t/:token',
    LOGIN: '/login',
    LOGOUT: '/logout',
    ERROR: '/error',
    JOIN: '/join/:token',
  };

  UUIDsToTranslate: Readonly<string[]> = [
    'companyId',
    'workspaceId',
    'channelId',
    'messageId',
    'threadId',
    'tabId',
    'directoryId',
    'documentId',
  ];

  readonly routes: RouteType[] = [
    {
      path: this.pathnames.LOGIN,
      exact: true,
      key: 'login',
      component: Login,
      options: {
        withErrorBoundary: true,
      },
    },
    {
      path: this.pathnames.LOGOUT,
      exact: true,
      key: 'logout',
      component: Logout,
      options: {
        withErrorBoundary: true,
      },
    },
    {
      path: this.pathnames.CLIENT,
      key: 'client',
      exact: false,
      component: App,
      options: {
        withErrorBoundary: true,
      },
    },
    {
      path: this.pathnames.SHARED_WITH_ME,
      key: 'client_shared',
      exact: false,
      component: App,
      options: {
        withErrorBoundary: true,
      },
    },
    {
      path: this.pathnames.SHARED,
      key: 'shared',
      exact: true,
      component: PublicMainView,
      options: {
        withErrorBoundary: false,
      },
    },
    {
      path: this.pathnames.ERROR,
      exact: true,
      component: Error,
    },
    {
      path: this.pathnames.JOIN,
      exact: false,
      key: 'join',
      component: Join,
      options: {
        withErrorBoundary: false,
      },
    },
  ];

  constructor() {
    super();
    this.history.listen(() => {
      this.notify();
      this.setRecoilState(this.getStateFromRoute());
    });

    // Transform mobile join format from /?join=token to /join/:token
    const join = new URLSearchParams(document.location.search).get('join');
    if (join) this.push('/join/' + join);
  }

  useRouteState(observedScope?: (state: ClientStateType) => ClientStateType): ClientStateType {
    return this.useWatcher(() => {
      const state = this.getStateFromRoute();
      return observedScope ? observedScope(state) : state;
    });
  }

  /**
   * Generate state from routing
   */
  getStateFromRoute(): ClientStateType {
    let match: any = null;
    this.clientSubPathnames
      .concat(this.pathnames.SHARED)
      .sort((a, b) => b.length - a.length)
      .forEach(route => {
        if (!match) {
          match = this.match(route) as any;
        }
      });

    const reducedState: any = {
      companyId: match?.params?.companyId || '',
      viewId: match?.params?.viewId || '',
      itemId: match?.params?.itemId || '',
      dirId: match?.params?.dirId || '',
      workspaceId: match?.params?.workspaceId || '',
      channelId: match?.params?.channelId || '',
      messageId: match?.params?.messageId || '',
      threadId: match?.params?.threadId || '',
      tabId: match?.params?.tabId || '',
      directoryId: match?.params?.directoryId || '',
      documentId: match?.params?.documentId || '',
      token: match?.params?.token || '',
      appName: match?.params?.appName || '',
      shared: !!this.match(this.pathnames.SHARED),
      sharedWithMe: !!this.match(this.pathnames.SHARED_WITH_ME),
    };

    const queryParameters = this.allowedQueryParameters[match?.path];

    if (queryParameters && this.history.location.search) {
      const params = new URLSearchParams(this.history.location.search);

      params.forEach((value, key) => {
        const alias = queryParameters.get(key);
        if (alias) {
          reducedState[alias] = value;
        }
      });
    }

    const state: any = {};
    Object.keys(reducedState).forEach(key => {
      try {
        state[key] =
          reducedState[key] && this.UUIDsToTranslate.includes(key)
            ? this.translator.toUUID(reducedState[key])
            : reducedState[key];
      } catch (err) {
        state[key] = reducedState[key];
      }
    });

    return state;
  }

  /**
   * Generate UUID to shortened and create url
   */
  generateRouteFromState(
    params: ClientStateType = {},
    options: { replace?: boolean; keepSearch?: boolean } = {},
  ): string {
    const currentState = { ...this.getStateFromRoute() };

    if (params.workspaceId === 'direct') {
      //Find a workspace to open as direct isn't a real workspace
      const workspace = getWorkspacesByCompany(params.companyId || currentState.companyId || '');
      if (workspace.length > 0) {
        params.workspaceId = workspace[0].id;
      }
    }

    if (params.channelId && params.channelId !== currentState.channelId) {
      currentState.threadId = undefined;
      currentState.messageId = undefined;
    }

    const expandedState: any = options?.replace ? params : Object.assign(currentState, params);
    const state: any = {};
    Object.keys(expandedState).forEach(key => {
      try {
        state[key] =
          expandedState[key] && this.UUIDsToTranslate.includes(key)
            ? this.translator.fromUUID(expandedState[key])
            : expandedState[key];
      } catch (err) {
        state[key] = expandedState[key];
      }
    });

    let search = options?.keepSearch ? '?' + this.history.location.search.substr(1) : '';

    if (state.shared) {
      return (
        `/shared/${state.companyId}` +
        (state.documentId ? `/${state.appName}/${state.documentId}` : '') +
        (state.token ? `/t/${state.token}` : '') +
        search
      );
    }

    if (state.tabId) {
      return (
        `${this.pathnames.CLIENT}` +
        (state.companyId ? `/${state.companyId}` : '') +
        (state.workspaceId ? `/w/${state.workspaceId}` : '') +
        (state.channelId ? `/c/${state.channelId}` : '') +
        (state.tabId ? `/tab/${state.tabId}` : '') +
        search
      );
    }

    const searchParameters = new URLSearchParams(search ? search.substring(1) : '');
    search = searchParameters.toString() ? `?${searchParameters.toString()}` : '';

    return (
      `${this.pathnames.CLIENT}` +
      (state.companyId ? `/${state.companyId}` : '') +
      (state.viewId ? `/v/${state.viewId}` : '') +
      (state.dirId ? `/d/${state.dirId}` : '') +
      (state.itemId ? `/preview/${state.itemId}` : '') +
      (state.sharedWithMe ? `/shared-with-me` : '') +
      (state.workspaceId ? `/w/${state.workspaceId}` : '') +
      (state.channelId ? `/c/${state.channelId}` : '') +
      (state.threadId ? `/t/${state.threadId}` : '') +
      (state.messageId ? `/m/${state.messageId}` : '') +
      search
    );
  }

  /**
   * Add redirection in url
   */
  addRedirection(route: string): string {
    const existingRef = decodeURIComponent(
      (this.history.location.search.split('ref=')[1] || '').split('&')[0],
    );
    const ref = existingRef ? existingRef : document.location + '';
    const separator = route.indexOf('?') < 0 ? '?' : '&';
    if (route === document.location.pathname) {
      return route;
    }
    return route + separator + 'ref=' + encodeURIComponent(ref);
  }

  /**
   * If redirection is present in url we redirect the user to it. Otherwise we return false;
   */
  useRedirection(): boolean {
    const existingRef = decodeURIComponent(
      (this.history.location.search.split('ref=')[1] || '').split('&')[0],
    );
    if (existingRef) {
      document.location.assign(existingRef);
      return true;
    }
    return false;
  }

  push(path: string, state?: unknown): void {
    return this.history.push(path, state);
  }

  replace(path: string, state?: unknown): void {
    return this.history.replace(path, state);
  }
}

export default new RouterServices();
