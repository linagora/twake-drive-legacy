import { useRecoilState, useRecoilValue } from 'recoil';

import { WorkspaceType } from '@features/workspaces/types/workspace';
import { WorkspaceListStateFamily } from '../state/workspace-list';
import useRouterWorkspace from '@features/router/hooks/use-router-workspace';
import RouterService from '@features/router/services/router-service';
import _ from 'lodash';
import WorkspacesService from '@deprecated/workspaces/workspaces.jsx';
import LocalStorage from '@features/global/framework/local-storage-service';
import useRouterCompany from '@features/router/hooks/use-router-company';
import WorkspaceAPIClient from '@features/workspaces/api/workspace-api-client';
import Workspaces from '@deprecated/workspaces/workspaces.jsx';
import { LoadingState } from '../../global/state/atoms/Loading';
import { useCurrentUser } from '@features/users/hooks/use-current-user';
import { useEffect } from 'react';

export const useWorkspacesCommons = (companyId = '') => {
  const [workspaces, setWorkspaces] = useRecoilState(WorkspaceListStateFamily(companyId));
  const [loading, setLoading] = useRecoilState(LoadingState(`workspaces-${companyId}`));

  const routerWorkspaceId = useRouterWorkspace();
  const bestCandidate = useBestCandidateWorkspace(companyId, workspaces);

  const refresh = async () => {
    if (workspaces?.length === 0) {
      setLoading(true);
    }
    const updated = await WorkspaceAPIClient.list(companyId);
    setWorkspaces(updated);
    if (updated?.length === 0) WorkspacesService.openNoWorkspacesPage();
    setLoading(false);
  };

  if (!routerWorkspaceId && bestCandidate) {
    RouterService.push(
      RouterService.generateRouteFromState({
        workspaceId: bestCandidate.id,
      }),
    );
  }

  return { workspaces, loading, refresh };
};

export function useWorkspaceLoader(companyId: string) {
  const loading = useRecoilValue(LoadingState(`workspaces-${companyId}`));
  return { loading };
}

export function useCurrentWorkspace() {
  const companyId = useRouterCompany();
  const routerWorkspaceId = useRouterWorkspace();
  const { workspaces, refresh } = useWorkspacesCommons(companyId);
  const workspace = workspaces.find(w => w.id === routerWorkspaceId);

  //Retro compatibility
  useEffect(() => {
    Workspaces.updateCurrentWorkspaceId(workspace?.id || '');
    Workspaces.updateCurrentCompanyId(workspace?.company_id || '');
  }, [routerWorkspaceId, companyId]);
  //End

  return { workspace, refresh };
}

export function useWorkspace(workspaceId: string) {
  const companyId = useRouterCompany();
  const { workspaces, refresh } = useWorkspacesCommons(companyId);
  const workspace = (workspaces || []).find(w => w.id === workspaceId);
  return { workspace, refresh };
}

/**
 * Workspace priority:
 * 1. Router workspace id
 * 2. Local storage workspace id
 * 3. User's preferences
 * 4. User's workspace with the most total members
 *
 * @param workspaces
 * @returns WorkspaceType | undefined
 */
export function useBestCandidateWorkspace(
  companyId: string,
  workspaces: WorkspaceType[],
): WorkspaceType | undefined {
  const { user } = useCurrentUser();
  const routerWorkspaceId = useRouterWorkspace();
  const storageWorkspaceId =
    (LocalStorage.getItem('default_workspace_id_' + companyId) as string) || null;
  const recentWorkspaceObj =
    user?.preferences && user?.preferences?.recent_workspaces
      ? user.preferences.recent_workspaces[0]
      : undefined;

  return (
    workspaces?.find(w => w.id === routerWorkspaceId) ||
    workspaces?.find(w => w.id === storageWorkspaceId) ||
    workspaces?.find(w => w.id === recentWorkspaceObj?.workspace_id) ||
    _.cloneDeep(workspaces)?.sort((a, b) => a?.stats?.total_members - b.stats?.total_members)[0] ||
    workspaces[0]
  );
}
