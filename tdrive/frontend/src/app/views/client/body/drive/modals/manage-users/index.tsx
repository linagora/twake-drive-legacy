import { useState } from 'react';
import { Modal } from '@atoms/modal';
import Avatar from '@atoms/avatar';
import { Base, Info } from '@atoms/text';
import { atom, useRecoilState } from 'recoil';
import { useDriveItem } from '@features/drive/hooks/use-drive-item';
import AlertManager from '@features/global/services/alert-manager-service';
import { useCurrentUser } from '@features/users/hooks/use-current-user';
import { useUser } from '@features/users/hooks/use-user';
import currentUserService from '@features/users/services/current-user-service';
import { useUserCompanyList } from '@features/users/hooks/use-user-company-list';
import { AccessLevel } from './common';
import Languages from 'features/global/services/languages-service';
import { DriveFileAccessLevel } from 'app/features/drive/types';

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
  const userList = useUserCompanyList();
  return (
    <Modal open={state.open} onClose={() => setState({ open: false })}>
      <Base className="block mt-4 mb-1">
        {Languages.t('components.internal-manage_root_users')}
      </Base>
      <div className="rounded-md border mt-2">
        {userList?.map(user => (
          <UserAccessLevel key={user.id} id="root" userId={user?.id || ""} username={user.username} role={user?.companies?.[0]?.role || ""} />
        ))}
        <div className="-mb-px" />
      </div>
    </Modal>
  );
};

const UserAccessLevel = ({
  id,
  userId,
  username,
  role
}: {
  id: string;
  userId: string;
  username: string;
  role: string;
}) => {
  const user = useUser(userId);
  const { user: currentUser } = useCurrentUser();
  const { item, loading, updateLevel } = useDriveItem(id);
  const [level, setLevel] = useState<DriveFileAccessLevel>(role == "admin" ? "manage" : "read");
  //const level = role == "admin" ? "manage" : "read";

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
        <Base>{username} </Base>{' '}
        {user?.id === currentUser?.id && (
          <Info>{Languages.t('components.internal-access_specific_rules_you')}</Info>
        )}
      </div>
      <div className="shrink-0 ml-2">
        <AccessLevel
          disabled={userId === currentUser?.id}
          level={level}
          canRemove
          onChange={level => {
            setLevel(level);
            updateLevel(userId || '', level);
          }}
        />
      </div>
    </div>
  );
};
