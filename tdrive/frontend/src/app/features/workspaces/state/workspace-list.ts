/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { atomFamily, selectorFamily, useSetRecoilState } from 'recoil';

import { WorkspaceType } from '@features/workspaces/types/workspace';
import WorkspaceAPIClient from '@features/workspaces/api/workspace-api-client';
import Logger from '@features/global/framework/logger-service';

const logger = Logger.getLogger('WorkspaceListState');

const workspacesCompanyMap: { [key: string]: WorkspaceType[] } = {};

export const getWorkspacesByCompany = (companyId: string) => {
  return workspacesCompanyMap[companyId] || [];
};

export const WorkspaceListStateFamily = atomFamily<WorkspaceType[], string>({
  key: 'WorkspaceListStateFamily',
  default: () => [],
  effects_UNSTABLE: companyId => [
    ({ onSet }) => {
      onSet(workspaces => {
        workspacesCompanyMap[companyId] = workspaces;
      });
    },
  ],
});

export const WorkspaceGetOrFetch = selectorFamily<
  WorkspaceType | undefined,
  { companyId: string; workspaceId: string }
>({
  key: 'WorkspaceGet',
  get:
    ({ companyId, workspaceId }) =>
    async ({ get }) => {
      // FIXME: This fails because we use hook out of hook context
      const setWorkspaces = useSetRecoilState(WorkspaceListStateFamily(companyId));
      let result = get(WorkspaceListStateFamily(companyId)).find(
        ws => ws.id === workspaceId && ws.company_id === companyId,
      );

      if (result) {
        return result;
      }

      try {
        result = await WorkspaceAPIClient.get(companyId, workspaceId);
      } catch (err) {
        logger.error('Can not get workspace in WorkspaceGetOrFetch', err);
      }

      if (result) {
        setWorkspaces(previous => [...previous, result!]);
      }

      return result;
    },
});

export const getWorkspacesForCompanySelector = selectorFamily<WorkspaceType[], string>({
  key: 'getWorkspacesForCompanySelector',
  get:
    companyId =>
    ({ get }) => {
      logger.debug('getWorkspacesForCompanySelector', companyId);

      return get(WorkspaceListStateFamily(companyId)).filter(ws => ws.company_id === companyId);
    },
});

export const getWorkspaceInCompanySelector = selectorFamily<
  WorkspaceType | undefined,
  { companyId: string; workspaceId: string }
>({
  key: 'getWorkspaceInCompanySelector',
  get:
    ({ companyId, workspaceId }) =>
    ({ get }) => {
      logger.debug('getWorkspaceInCompanySelector', companyId, workspaceId);
      const workspaces = get(getWorkspacesForCompanySelector(companyId));

      return (workspaces || []).find(ws => ws.id === workspaceId);
    },
});
