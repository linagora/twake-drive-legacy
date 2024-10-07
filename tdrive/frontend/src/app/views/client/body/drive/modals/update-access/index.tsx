import { Modal, ModalContent } from '@atoms/modal';
import { useDriveItem } from '@features/drive/hooks/use-drive-item';
import { useEffect } from 'react';
import { atom, useRecoilState } from 'recoil';
import { InternalUsersAccessManager } from './internal-users-access';
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
  const closeModal = () => setState({ ...state, open: false });
  return (
    <Modal
      open={state.open}
      className='!overflow-visible'
      onClose={closeModal}
      >
      {!!state.id && <AccessModalContent id={state.id} onCloseModal={closeModal} />}
    </Modal>
  );
};

const AccessModalContent = (props: {
  id: string,
  onCloseModal: () => void,
}) => {
  const { id } = props;
  const { item, access, loading, update, refresh } = useDriveItem(id);
  const { refresh: refreshCompany } = useCurrentCompany();
  useEffect(() => {
    refresh(id);
    refreshCompany();
  }, []);

  return (
    <ModalContent
      title={
          <>
            {Languages.t('components.internal-access_manage_title') + ' '}
            <strong>{item?.name}</strong>
          </>
        }
      >
      <div className={loading ? 'opacity-50' : ''}>
        {FeatureTogglesService.isActiveFeatureName(FeatureNames.COMPANY_MANAGE_ACCESS) && (
          <InternalUsersAccessManager id={id} disabled={access !== 'manage'} onCloseModal={props.onCloseModal} />
        )}
      </div>
    </ModalContent>
  );
};
