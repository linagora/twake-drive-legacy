import Avatar from '@atoms/avatar';
import { Base, Info } from '@atoms/text';
import Menu from '@components/menus/menu';
import LoginService from '@features/auth/login-service';
import { useCurrentUser } from '@features/users/hooks/use-current-user';
import currentUserService from '@features/users/services/current-user-service';
import AccountParameter from '@views/client/popup/UserParameter/UserParameter';
import Languages from '../../../features/global/services/languages-service';
import ModalManagerDepreciated from '@deprecated/popupManager/popupManager';
import FeatureTogglesService, {
  FeatureNames,
} from '@features/global/services/feature-toggles-service';

export default ({ sidebar }: { sidebar?: boolean }): JSX.Element => {
  const { user } = useCurrentUser();

  if (!user) return <></>;

  return (
    <Menu
      className="flex flex-row items-center max-w-xs cursor-pointer"
      position="bottom"
      menu={[
        {
          type: 'menu',
          icon: 'user',
          text: Languages.t('scenes.app.channelsbar.currentuser.title'),
          //hide: InitService.server_infos?.configuration?.accounts?.type === 'remote',
          onClick: () => {
            ModalManagerDepreciated.open(<AccountParameter />, true, 'account_parameters');
          },
        },
        {
          type: 'menu',
          icon: 'sign-out-alt',
          text: Languages.t('scenes.app.channelsbar.currentuser.logout'),
          className: 'error',
          onClick: () => {
            LoginService.logout();
          },
        },
      ]}
    >
      <Avatar
        size="md"
        className="shrink-0 border-0"
        avatar={user.thumbnail}
        title={currentUserService.getFullName(user)}
      />
      <div
        className={'sm:block ml-2 mr-2 flex flex-col overflow-hidden ' + (sidebar ? '' : 'hidden')}
      >
        <Base className="font-bold overflow-hidden text-ellipsis whitespace-nowrap w-full block -mb-1">
          {currentUserService.getFullName(user)}
        </Base>

        { !FeatureTogglesService.isActiveFeatureName(FeatureNames.COMPANY_DISPLAY_EMAIL) && (
          <Info className="font-semibold overflow-hidden text-ellipsis whitespace-nowrap w-full">
            {user.email}
          </Info>
        )}
      </div>
    </Menu>
  );
};
