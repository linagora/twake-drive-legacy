import { Button } from '@atoms/button/button';
import { InputLabel } from '@atoms/input/input-decoration-label';
import { Input } from '@atoms/input/input-text';
import { Modal, ModalContent } from '@atoms/modal';
import { useDriveActions } from '@features/drive/hooks/use-drive-actions';
import { useDriveItem } from '@features/drive/hooks/use-drive-item';
import { useEffect, useRef, useState } from 'react';
import { atom, useRecoilState } from 'recoil';
import Languages from '@features/global/services/languages-service';

export type PropertiesModalType = {
  open: boolean;
  id: string;
  inPublicSharing?: boolean;
};

export const PropertiesModalAtom = atom<PropertiesModalType>({
  key: 'PropertiesModalAtom',
  default: {
    open: false,
    id: '',
    inPublicSharing: false,
  },
});

export const PropertiesModal = () => {
  const [state, setState] = useRecoilState(PropertiesModalAtom);

  return (
    <Modal open={state.open} onClose={() => setState({ ...state, open: false })}>
      {!!state.id && (
        <PropertiesModalContent
          id={state.id}
          onClose={() => setState({ ...state, open: false })}
          inPublicSharing={state.inPublicSharing}
        />
      )}
    </Modal>
  );
};

const PropertiesModalContent = ({ id, onClose, inPublicSharing }: { id: string; onClose: () => void, inPublicSharing?: boolean }) => {
  const { item, refresh } = useDriveItem(id);
  const { update } = useDriveActions(inPublicSharing);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refresh(id);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const lastDot = inputRef.current.value.lastIndexOf('.');
        const endRange = lastDot >= 0 ? lastDot : inputRef.current.value.length;
        inputRef.current.setSelectionRange(0, endRange);
      }
    }, 100);
  }, []);

  useEffect(() => {
    if (!name) setName(item?.name || '');
  }, [item?.name]);

  const doSave = async () => {
    setLoading(true);
    if (item) {
      let finalName = (name || '').trim();
      //TODO: Confirm rename if extension changed ?
      if (!item?.is_directory) {
        //TODO: Why do we trim extensions on folders ?
        const lastDotIndex = finalName.lastIndexOf('.');
        if (lastDotIndex !== -1) {
          const fileExtension = name.slice(lastDotIndex);
          finalName = finalName.slice(0, lastDotIndex) + fileExtension;
        }
      }
      await update({ name: finalName }, id, item.parent_id);
    }
    onClose();
    setLoading(false);
  }

  return (
    <ModalContent
      title={Languages.t('components.PropertiesModalContent_rename') + ' ' + item?.name}
    >
      <InputLabel
        className="mt-4"
        label={Languages.t('components.PropertiesModalContent_name')}
        input={
          <Input
            value={name}
            inputRef={inputRef}
            onChange={e => setName(e.target.value)}
            onKeyUp={({ key }) => {
              if (!loading) {
                if (key === 'Enter')
                  doSave();
                else if (key === "Escape")
                  onClose();
              }
            }}
            placeholder={Languages.t('components.PropertiesModalContent_place_holder')}
          />
        }
      />
      <br />
      <Button
        disabled={!((name || '').trim())}
        className="float-right mt-4"
        theme="primary"
        loading={loading}
        onClick={doSave}
      >
        {Languages.t('components.PropertiesModalContent_update_button')}
      </Button>
    </ModalContent>
  );
};
