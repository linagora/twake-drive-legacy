/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import Api from '@features/global/framework/api-service';
import FeatureTogglesService, {
  FeatureNames,
} from '@features/global/services/feature-toggles-service';
import { FeatureToggles, Feature, withFeatures } from '@paralleldrive/react-feature-toggles';
import RouterService from '@features/router/services/router-service';
import { useCurrentCompany } from '@features/companies/hooks/use-companies';
import { CompanyType } from 'app/features/companies/types/company';

export const useFeatureToggles = (anonymous = false) => {
  const routeState = RouterService.getStateFromRoute();
  const { activeFeatureNames } = FeatureTogglesService;
  const [fetchedCompany, setFetchedCompany] = useState<CompanyType>();
  const company = anonymous ? fetchedCompany : useCurrentCompany()?.company;

  useEffect(() => {
    if (anonymous) {
      const fetchCompany = async () => {
        try {
          if (!routeState?.companyId) return;

          const res = (await Api.get(
            `/internal/services/users/v1/companies/${routeState.companyId}`,
          )) as any;
          if (res?.resource) {
            console.log('Company fetched (anonymous)', res);
            setFetchedCompany(res.resource); // Assuming `res.resource` is structured correctly.
          }
        } catch (error) {
          console.error('Error fetching company (anonymous):', error);
        }
      };

      fetchCompany();
    }
  }, [anonymous, routeState?.companyId]);

  useEffect(() => {
    const companyPlan = company?.plan;
    if (companyPlan) {
      console.log('Company plan:', companyPlan);
      FeatureTogglesService.setFeaturesFromCompanyPlan(companyPlan as any);
    } else {
      console.warn('Company plan is undefined');
    }
  }, [JSON.stringify(company)]);

  return {
    activeFeatureNames,
    FeatureToggles,
    Feature,
    withFeatures,
    FeatureNames,
  };
};
