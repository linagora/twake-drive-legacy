import { Modal } from '@atoms/modal';
import Avatar from '@atoms/avatar';
import { Base, Info } from '@atoms/text';
import { atom, useRecoilState } from 'recoil';
import { useDriveItem } from '@features/drive/hooks/use-drive-item';
import { DriveFileAccessLevel } from '@features/drive/types';
import AlertManager from '@features/global/services/alert-manager-service';
import { useCurrentUser } from '@features/users/hooks/use-current-user';
import { useUser } from '@features/users/hooks/use-user';
import currentUserService from '@features/users/services/current-user-service';
import { UserType } from '@features/users/types/user';
import { useUserList } from '@features/users/hooks/use-user-list';
import { useState } from 'react';
import SelectUsers from '../../components/select-users';
import { AccessLevel } from './common';
import Languages from 'features/global/services/languages-service';

export type UsersModalType = {
  open: boolean;
};

export const UsersModalAtom = atom<UsersModalType>({
  key: 'UsersModalAtom',
  default: {
    open: false,
  },
});

export const UsersModal = () => {
  const [state, setState] = useRecoilState(UsersModalAtom);
  const { userList } = useUserList();

  return (
    <Modal open={state.open} onClose={() => setState({ open: false })}>
      <Base className="block mt-4 mb-1">
        {Languages.t('components.internal-access_specific_rules')}
      </Base>
      <div className="rounded-md border mt-2">
        {(userList || [])?.map(user => (
          <UserAccessLevel key={user.id} id={user?.id || ""} userId={user?.id || ""} />
        ))}
        <div className="-mb-px" />
      </div>
    </Modal>
  );
};

const UserAccessLevel = ({
  id,
  userId
}: {
  id: string;
  userId: string;
}) => {
  const { item, loading, update } = useDriveItem(id);
  const user = useUser(userId);
  const { user: currentUser } = useCurrentUser();
  const level = "manage";

  return (
    <div className="p-4 border-t flex flex-row items-center justify-center">
      <div className="shrink-0">
        <Avatar
          avatar={user?.thumbnail || ''}
          title={!user ? '-' : currentUserService.getFullName(user)}
          size="sm"
        />
      </div>
      <div className="grow ml-2">
        <Base>{!!user && currentUserService.getFullName(user)}</Base>{' '}
        {user?.id === currentUser?.id && (
          <Info>{Languages.t('components.internal-access_specific_rules_you')}</Info>
        )}
      </div>
      <div className="shrink-0 ml-2">
        <AccessLevel
          disabled={loading || user?.id === currentUser?.id}
          level={level}
          canRemove
          onChange={level => {
            console.log(level)
          }}
        />
      </div>
    </div>
  );
};
