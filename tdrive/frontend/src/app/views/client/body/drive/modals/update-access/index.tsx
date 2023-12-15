import { Modal, ModalContent } from '@atoms/modal';
import { useDriveItem } from '@features/drive/hooks/use-drive-item';
import { useEffect } from 'react';
import { atom, useRecoilState } from 'recoil';
import { InternalAccessManager } from './internal-access';
import { PublicLinkManager } from './public-link-access';
import { useCurrentCompany } from '@features/companies/hooks/use-companies';
import Languages from 'features/global/services/languages-service';
import FeatureTogglesService, {
  FeatureNames,
} from '@features/global/services/feature-toggles-service';

export type AccessModalType = {
  open: boolean;
  id: string;
};

export const AccessModalAtom = atom<AccessModalType>({
  key: 'AccessModalAtom',
  default: {
    open: false,
    id: '',
  },
});

export const AccessModal = () => {
  const [state, setState] = useRecoilState(AccessModalAtom);

  return (
    <Modal open={state.open} onClose={() => setState({ ...state, open: false })}>
      {!!state.id && <AccessModalContent id={state.id} />}
    </Modal>
  );
};

const AccessModalContent = ({ id }: { id: string }) => {
  const { item, access, refresh } = useDriveItem(id);
  const { company, refresh: refreshCompany } = useCurrentCompany();
  useEffect(() => {
    refresh(id);
    refreshCompany();
  }, []);
  // Check if the COMPANY_SEARCH_USERS feature is disabled
  const userSearchEnabled = !company.plan?.features?.[FeatureNames.COMPANY_SEARCH_USERS];
  console.log('user company is: ', company, 'InternalAccess: ', userSearchEnabled);
  return (
    <ModalContent
      title={Languages.t('components.item_context_menu.manage_access_to') + ' ' + item?.name}
    >
      <PublicLinkManager id={id} disabled={access !== 'manage'} />
      {FeatureTogglesService.isActiveFeatureName(FeatureNames.COMPANY_SEARCH_USERS) && (
        <InternalAccessManager id={id} disabled={access !== 'manage'} />
      )}
    </ModalContent>
  );
};
