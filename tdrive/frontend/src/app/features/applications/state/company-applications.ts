import { atomFamily, selectorFamily } from 'recoil';

import { Application } from 'app/features/applications/types/application';
import _ from 'lodash';

//Retro compatibility
const companyApplicationMap: Map<string, Application> = new Map();
const companyApplicationsMap: Map<string, Application[]> = new Map();
export const getCompanyApplication = (applicationId: string) => {
  return companyApplicationMap.get(applicationId);
};
export const getCompanyApplications = (companyId: string) => {
  return companyApplicationsMap.get(companyId) || [];
};
export const onChangeCompanyApplications = (companyId: string, _applications: Application[]) => {
  const applications = _.cloneDeep(_applications);
  companyApplicationsMap.set(companyId, applications);
  (applications || []).forEach(a => {
    if (!_.isEqual(a, companyApplicationMap.get(a.id))) {
      companyApplicationMap.set(a.id, a);
    }
  });
};
//Ends retro compatibility

export const CompanyApplicationsStateFamily = atomFamily<Application[], string>({
  key: 'CompanyApplicationsStateFamily',
  default: companyId => fetchCompanyApplications(companyId),
});

export const fetchCompanyApplications = selectorFamily<Application[], string>({
  key: 'fetchCompanyApplications',
  get: () => () => [],
});
