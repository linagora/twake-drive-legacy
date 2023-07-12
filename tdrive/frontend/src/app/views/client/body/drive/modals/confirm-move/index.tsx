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
import { ToasterService } from '@features/global/services/toaster-service';



export type ConfirmMoveModalType = {
  open: boolean;
  event: any;
};

export const ConfirmMoveModalAtom = atom<ConfirmMoveModalType>({
  key: 'ConfirmMoveModalAtom',
  default: {
    open: false,
    event: {},
  },
});

export const ConfirmMoveModal = (event:any) => {
  const [state, setState] = useRecoilState(ConfirmMoveModalAtom);

  return (
    <Modal open={state.open} onClose={() => setState({ ...state, open: false })}>
      {!!state.event && <ConfirmMoveModalContent event={event} />}
    </Modal>
  );
};

const ConfirmMoveModalContent = (event:any) => {
  const [loading, setLoading] = useState(false);
  const [state, setState] = useRecoilState(ConfirmMoveModalAtom);
  const [, setSelected] = useRecoilState(DriveItemSelectedList);
  const {update} = useDriveActions();


  return (
    <ModalContent
      title={
        "Test"
            }
    >
      <Base className="block my-3">
        {Languages.t('compenents.ConfirmMoveModalContent_move_to_move_desc')}
      </Base>
      <br />
      <Button
        className="float-right"
        loading={loading}
        onClick={async () => {
          update(
            {
              parent_id: event.over.data.current.child.props.item.id,
            },
            event.active.data.current.child.props.item.id,
            event.active.data.current.child.props.item.parent_id,
          );
          ToasterService.success(event.active.data.current.child.props.item.name+" "+Languages.t('components.dragndrop_info_move_to')+" "+event.over.data.current.child.props.item.name);
        }}
      >
        {Languages.t('compenents.ConfirmMoveModalContent_move_to_move')}
      </Button>
    </ModalContent>
  );
};
