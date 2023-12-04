import { Button } from '@atoms/button/button';
import { InputLabel } from '@atoms/input/input-decoration-label';
import { Input } from '@atoms/input/input-text';
import { Modal, ModalContent } from '@atoms/modal';
import { useDriveActions } from '@features/drive/hooks/use-drive-actions';
import { useDriveItem } from '@features/drive/hooks/use-drive-item';
import { useEffect, useState } from 'react';
import { atom, useRecoilState } from 'recoil';
import Languages from '@features/global/services/languages-service';

export type PropertiesModalType = {
  open: boolean;
  id: string;
};

export const PropertiesModalAtom = atom<PropertiesModalType>({
  key: 'PropertiesModalAtom',
  default: {
    open: false,
    id: '',
  },
});

export const PropertiesModal = () => {
  const [state, setState] = useRecoilState(PropertiesModalAtom);

  return (
    <Modal open={state.open} onClose={() => setState({ ...state, open: false })}>
      {!!state.id && (
        <PropertiesModalContent id={state.id} onClose={() => setState({ ...state, open: false })} />
      )}
    </Modal>
  );
};

const PropertiesModalContent = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const { item, refresh } = useDriveItem(id);
  const { update } = useDriveActions();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    refresh(id);
  }, []);

  useEffect(() => {
    if (!name) setName(item?.name || '');
  }, [item?.name]);

  return (
    <ModalContent
      title={Languages.t('compenents.ProprietiesModalContent_rename') + ' ' + item?.name}
    >
      <InputLabel
        className="mt-4"
        label={Languages.t('compenents.ProprietiesModalContent_name')}
        input={
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={Languages.t('compenents.ProprietiesModalContent_place_holder')}
          />
        }
      />
      <br />
      <Button
        disabled={!name}
        className="float-right mt-4"
        theme="primary"
        loading={loading}
        onClick={async () => {
          setLoading(true);
          if (item) {
            let finalName = name;
            if (!item?.is_directory) {
              const lastDotIndex = finalName.lastIndexOf('.');
              if (lastDotIndex !== -1) {
                finalName = finalName.slice(0, lastDotIndex);
              }
            }
            await update({ name: finalName }, id, item.parent_id);
          }
          onClose();
          setLoading(false);
        }}
      >
        {Languages.t('compenents.ProprietiesModalContent_update_button')}
      </Button>
    </ModalContent>
  );
};
