import { selector, selectorFamily } from 'recoil';
import { RouterState } from '../atoms/router';

export const RouterCompanySelector = selector<string>({
  key: 'RouterCompanySelector',
  get: ({ get }) => get(RouterState)?.companyId || '',
});

export const RouteViewSelector = selector<string>({
  key: 'RouterViewSelector',
  get: ({ get }) => get(RouterState)?.viewId || '',
});

export const RoutePreviewSelector = selector<string>({
  key: 'RouterPreviewSelector',
  get: ({ get }) => get(RouterState)?.itemId || '',
});

export const RouteDirectorySelector = selector<string>({
  key: 'RouterDirectorySelector',
  get: ({ get }) => get(RouterState)?.dirId || '',
});

export const RouterWorkspaceSelector = selector<string>({
  key: 'RouterWorkspaceSelector',
  get: ({ get }) => get(RouterState)?.workspaceId || '',
});

export const RouterChannelSelector = selector<string>({
  key: 'RouterChannelSelector',
  get: ({ get }) => get(RouterState)?.channelId || '',
});

export const RouterTabSelector = selector<string>({
  key: 'RouterTabSelector',
  get: ({ get }) => get(RouterState)?.tabId || '',
});

export const RouterChannelSelectedSelector = selectorFamily<boolean, string>({
  key: 'RouterChannelSelectedSelector',
  get:
    testedChannelId =>
    ({ get }) =>
      get(RouterState)?.channelId === testedChannelId,
});

export const RouterWorkspaceSelectedSelector = selectorFamily<boolean, string>({
  key: 'RouterWorkspaceSelectedSelector',
  get:
    testedWorkspaceId =>
    ({ get }) =>
      get(RouterState)?.workspaceId === testedWorkspaceId,
});
