import React, { useEffect, useState } from 'react';
import { Button } from '@atoms/button/button';
import { Modal, ModalContent } from '@atoms/modal';
import { useDriveItem } from '@features/drive/hooks/use-drive-item';
import { DriveItem } from '@features/drive/types';
import { atom, useRecoilState } from 'recoil';
import Languages from '@features/global/services/languages-service';

export type ConfirmModalType = {
  open: boolean;
  parent_id: string;
  mode: 'move' | 'select-file' | 'select-files';
  title: string;
  onSelected?: (ids: string[]) => Promise<void>;
};

export const ConfirmModalAtom = atom<ConfirmModalType>({
  key: 'ConfirmModalAtom',
  default: {
    open: false,
    parent_id: '',
    mode: 'move',
    title: '',
  },
});

const ConfirmModalContent = () => {
  const [state, setState] = useRecoilState(ConfirmModalAtom);
  const [selected, setSelected] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const parentId = state.parent_id;

  const { item: parent } = useDriveItem(parentId);

  useEffect(() => {
    if (state.mode === 'select-file' && parent) setSelected([]);
    if (state.mode === 'move' && parent) setSelected([parent]);
  }, [parentId, parent?.id]);

  const handleClose = async () => {
    setLoading(true);
    state.onSelected && await state.onSelected(selected.map((i) => i.id));
    setState({ ...state, open: false });
    setLoading(false);
  };

  return (
    <ModalContent title={state.title}>
      <Button
        disabled={selected.length === 0}
        loading={loading}
        theme="primary"
        className="float-right"
        onClick={handleClose}
      >
        <>{Languages.t('components.SelectorModalContent_move_to')} '{selected[0]?.name}'</>
      </Button>
    </ModalContent>
  );
};

export const ConfirmModal = () => {
  const [state, setState] = useRecoilState(ConfirmModalAtom);

  const handleClose = () => {
    setState({ ...state, open: false });
  };

  return (
    <Modal open={state.open} onClose={handleClose}>
      <ConfirmModalContent key={state.parent_id} />
    </Modal>
  );
};
