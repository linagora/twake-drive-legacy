import Avatar from '@atoms/avatar';
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
        // user name / email
        {
          type: 'text',
          text: currentUserService.getFullName(user),
        },
        {
          type: 'text',
          text: user.email,
          icon: 'envelope-info',
          hide: !FeatureTogglesService.isActiveFeatureName(FeatureNames.COMPANY_DISPLAY_EMAIL),
        },
        { type: 'separator' },
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
    </Menu>
  );
};
