import { Button } from '@atoms/button/button';
import { Modal, ModalContent } from '@atoms/modal';
import { useDriveItem } from '@features/drive/hooks/use-drive-item';
import { DriveItem } from '@features/drive/types';
import { useEffect, useState } from 'react';
import { atom, useRecoilState } from 'recoil';
import Languages from '@features/global/services/languages-service';

export type ConfirmModalType = {
  open: boolean;
  parent_id: string;
  mode: 'move' | 'select-file' | 'select-files';
  title: string;
  onSelected: (ids: string[]) => Promise<void>;
};

export const ConfirmModalAtom = atom<ConfirmModalType>({
  key: 'ConfirmModalAtom',
  default: {
    open: false,
    parent_id: '',
    mode: 'move',
    title: '',
    onSelected: async () => {},
  },
});

export const ConfirmModal = () => {
  const [state, setState] = useRecoilState(ConfirmModalAtom);

  return (
    <Modal open={state.open} onClose={() => setState({ ...state, open: false })}>
      <ConfirmModalContent key={state.parent_id} showfiles={false}/>
    </Modal>
  );
};


const ConfirmModalContent = (key:any,showfiles:boolean) => {
  const [state, setState] = useRecoilState(ConfirmModalAtom);
  const [selected, setSelected] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [parentId, setParentId] = useState(state.parent_id);

  const { children, path, item: parent, refresh } = useDriveItem(parentId);

  useEffect(() => {
    if (state.mode === 'select-file' && parent) setSelected([]);
    if (state.mode === 'move' && parent) setSelected([parent]);
    refresh(parentId);
  }, [parentId, parent?.id]);

  const folders = (children?.filter(i => i.is_directory) || []).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const files = (children?.filter(i => !i.is_directory) || []).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <ModalContent title={state.title}>
      <Button
        disabled={selected.length === 0}
        loading={loading}
        theme="primary"
        className="float-right"
        onClick={async () => {
          setLoading(true);
          await state.onSelected(selected.map(i => i.id));
          setState({ ...state, open: false });
          setLoading(false);
        }}
      >
        {selected.length === 0 ? (
          <>{Languages.t('components.SelectorModalContent_no_items')}</>
        ) : state.mode === 'move' ? (
          <>{Languages.t('components.SelectorModalContent_move_to')} '{selected[0]?.name}'</>
        ) : selected.length > 1 ? (
          <> {selected.length} {Languages.t('components.SelectorModalContent_select')} {Languages.t('components.SelectorModalContent_files')}</>
        ) : (
          <>{Languages.t('components.SelectorModalContent_select')} '{selected[0]?.name}'</>
        )}
      </Button>
    </ModalContent>
  );
};