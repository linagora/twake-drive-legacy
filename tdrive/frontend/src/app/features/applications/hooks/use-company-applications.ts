import { useEffect } from 'react';
import { useRecoilState } from 'recoil';
import Logger from 'app/features/global/framework/logger-service';
import Languages from 'app/features/global/services/languages-service';
import { ToasterService as Toaster } from 'app/features/global/services/toaster-service';
import {
  CompanyApplicationsStateFamily,
  onChangeCompanyApplications,
} from '../state/company-applications';
import CompanyApplicationsAPIClient from 'app/features/applications/api/company-applications-api-client';
import { useCurrentCompany } from '../../companies/hooks/use-companies';
import { Application } from 'app/features/applications/types/application';
import { LoadingState } from 'app/features/global/state/atoms/Loading';
import useRouterWorkspace from 'app/features/router/hooks/use-router-workspace';
import { useGlobalEffect } from 'app/features/global/hooks/use-global-effect';
import useRouterCompany from 'app/features/router/hooks/use-router-company';

const logger = Logger.getLogger('useApplications');
/**
 * Use all applications in a company
 * @param companyId
 * @returns
 */
export function useCompanyApplications(companyId = '') {
  const routerCompanyId = useRouterCompany();
  companyId = companyId || routerCompanyId || '';
  const workspaceId = useRouterWorkspace();

  const [applications, setApplications] = useRecoilState(CompanyApplicationsStateFamily(companyId));
  const [loading, setLoading] = useRecoilState(LoadingState(`applications-${companyId}`));

  const refresh = async () => {
    try {
      const res = await CompanyApplicationsAPIClient.list(companyId);
      if (res) setApplications(res);
    } catch (e) {
      logger.error(`Error while trying to handle company applications changes`, e);
    }
    setLoading(false);
  };

  useEffect(() => {
    onChangeCompanyApplications(companyId, applications);
  }, [applications]);

  useGlobalEffect(
    'useCompanyApplications',
    () => {
      refresh();
    },
    [workspaceId],
  );

  const get = (applicationId: string): Application | null => {
    return applications.find(a => a.id === applicationId) || null;
  };

  const remove = async (applicationId: string) => {
    setLoading(true);
    try {
      await CompanyApplicationsAPIClient.remove(companyId, applicationId);
      Toaster.success(
        Languages.t('app.state.recoil.hooks.use_current_company_applications.toaster_delete', [
          get(applicationId)?.identity?.name || 'unknown',
        ]),
      );
    } catch (e) {
      Toaster.error(`Error while trying to delete one company application`);
      console.error(e);
    }
    await refresh();
  };

  const add = async (applicationId: string) => {
    logger.debug(`Proccessing add company application ${applicationId} in company `, companyId);
    setLoading(true);
    try {
      await CompanyApplicationsAPIClient.add(companyId, applicationId);
      Toaster.success(
        Languages.t('app.state.recoil.hooks.use_current_company_applications.toaster_add', [
          get(applicationId)?.identity?.name || 'unknown',
        ]),
      );
    } catch (e) {
      Toaster.error(`Error while trying to add one company application`);
      console.error(e);
    }
    await refresh();
  };

  const isInstalled = (applicationId: string) => (get(applicationId) ? true : false);

  return {
    applications: applications,
    get,
    loading,
    add,
    remove,
    isInstalled,
    refresh,
  };
}

/**
 * Use a single application
 * @param applicationId
 * @returns
 */
export const useCompanyApplication = (companyId: string, applicationId: string) => {
  const applications = useCompanyApplications(companyId);
  return {
    application: applications.get(applicationId),
    remove: () => applications.remove(applicationId),
    isInstalled: () => applications.isInstalled(applicationId),
  };
};
