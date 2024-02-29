import { Button } from '@atoms/button/button';
import { Modal, ModalContent } from '@atoms/modal';
import { Base } from '@atoms/text';
import { useDriveActions } from '@features/drive/hooks/use-drive-actions';
import { useDriveItem } from '@features/drive/hooks/use-drive-item';
import { DriveItemSelectedList } from '@features/drive/state/store';
import { DriveItem } from '@features/drive/types';
import { useEffect, useState } from 'react';
import { atom, useRecoilState } from 'recoil';
import Languages from '@features/global/services/languages-service';
import RouterServices from "features/router/services/router-service";


export type ConfirmTrashModalType = {
  open: boolean;
  items: DriveItem[];
};

export const ConfirmTrashModalAtom = atom<ConfirmTrashModalType>({
  key: 'ConfirmTrashModalAtom',
  default: {
    open: false,
    items: [],
  },
});

export const ConfirmTrashModal = () => {
  const [state, setState] = useRecoilState(ConfirmTrashModalAtom);

  return (
    <Modal open={state.open} onClose={() => setState({ ...state, open: false })}>
      {!!state.items.length && <ConfirmTrashModalContent items={state.items} />}
    </Modal>
  );
};

const ConfirmTrashModalContent = ({ items }: { items: DriveItem[] }) => {
  const { item, refresh } = useDriveItem(items[0].id);
  const { remove } = useDriveActions();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useRecoilState(ConfirmTrashModalAtom);
  const [, setSelected] = useRecoilState(DriveItemSelectedList);
  const { viewId } = RouterServices.getStateFromRoute();

  useEffect(() => {
    refresh(items[0].id);
  }, []);

  return (
    <ModalContent
      title={
        items.length === 1 ? Languages.t('compenents.ConfirmTrashModalContent_move') + "  '" + item?.name + "' " + Languages.t('compenents.ConfirmTrashModalContent_to_trash') : Languages.t('compenents.ConfirmTrashModalContent_move') + " " + items.length + " " + Languages.t('compenents.ConfirmTrashModalContent_items_to_trash')
      }
    >
      <Base className="block my-3">
        {Languages.t('compenents.ConfirmTrashModalContent_move_to_trash_desc')}
      </Base>
      <br />
      <Button
        className="float-right"
        loading={loading}
        onClick={async () => {
          setLoading(true);
          await Promise.all((items || []).map(async item => {
            let parent = item.parent_id;
            if (viewId === "shared_with_me" && parent && parent.startsWith("user_")) {
              console.log("Refresh shared_with_me");
              parent = "shared_with_me";
            }
            await remove(item.id, parent)
          }));
          setSelected({});
          setLoading(false);
          await refresh("trash");
          setState({ ...state, open: false });
        }}
      >
        {Languages.t('compenents.ConfirmTrashModalContent_move_to_trash')}
      </Button>
    </ModalContent>
  );
};
