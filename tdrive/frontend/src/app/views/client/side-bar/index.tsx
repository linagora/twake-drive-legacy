import { Button } from '@atoms/button/button';
import {
  ClockIcon,
  CloudIcon,
  ExternalLinkIcon,
  HeartIcon,
  ShareIcon,
  TrashIcon,
  UserIcon,
  UserGroupIcon,
} from '@heroicons/react/outline';
import { useEffect } from 'react';
import useRouterCompany from '@features/router/hooks/use-router-company';
import { useCurrentUser } from 'app/features/users/hooks/use-current-user';
import { useRecoilState } from 'recoil';
import { Title } from '../../../atoms/text';
import { useDriveItem } from '../../../features/drive/hooks/use-drive-item';
import { DriveCurrentFolderAtom } from '../body/drive/browser';
import Account from '../common/account';
import AppGrid from '../common/app-grid';
import DiskUsage from '../common/disk-usage';
import Actions from './actions';
import { useHistory } from 'react-router-dom';
import RouterServices from '@features/router/services/router-service';
import Languages from 'features/global/services/languages-service';
import FeatureTogglesService, {
  FeatureNames,
} from '@features/global/services/feature-toggles-service';

export default () => {
  const history = useHistory();
  const { user } = useCurrentUser();
  const company = useRouterCompany();
  const { viewId, itemId, dirId } = RouterServices.getStateFromRoute();
  const [parentId, setParentId] = useRecoilState(
    DriveCurrentFolderAtom({ initialFolderId: viewId || 'user_' + user?.id }),
  );
  const active = false;
  const { sharedWithMe, inTrash, path } = useDriveItem(parentId);
  const activeClass = 'bg-zinc-50 dark:bg-zinc-900 !text-blue-500';
  let folderType = 'home';
  if ((path || [])[0]?.id === 'user_' + user?.id) folderType = 'personal';
  if (inTrash) folderType = 'trash';
  if (sharedWithMe) folderType = 'shared';

  useEffect(() => {
    !itemId && !dirId && viewId && setParentId(viewId);
    dirId && viewId && setParentId(dirId);
  }, [viewId, itemId, dirId]);
  return (
    <div className="grow flex flex-col overflow-auto -m-4 p-4 relative testid:sidebar">
      <div className="grow">
        <div className="sm:hidden block mb-2">
          <div className="flex flex-row space-between w-full">
            <div className="flex items-center order-1 grow">
              <img
                src="/public/img/logo/logo-text-black.svg"
                className="h-6 ml-1 dark:hidden block"
                alt="Tdrive"
              />
              <img
                src="/public/img/logo/logo-text-white.svg"
                className="h-6 ml-1 dark:block hidden"
                alt="Tdrive"
              />
            </div>
            <div className="md:grow order-3 md:order-2">
              <Account />
            </div>
            <div className="order-2 md:order-3 mr-2 md:mr-0">
              <AppGrid />
            </div>
          </div>

          <div className="mt-6" />
          <Title>Actions</Title>
        </div>

        <Actions />

        <div className="mt-4" />
        <Title>Drive</Title>
        <Button
          onClick={() => {
            history.push(
              RouterServices.generateRouteFromState({
                companyId: company,
                viewId: 'user_' + user?.id,
                itemId: '',
                dirId: '',
              }),
            );
            // setParentId('user_' + user?.id);
          }}
          size="lg"
          theme="white"
          className={
            'w-full mb-1 ' +
            (folderType === 'personal' && (viewId == '' || viewId == 'user_' + user?.id)
              ? activeClass
              : '')
          }
          testClassId="sidebar-menu-my-drive"
        >
          <UserIcon className="w-5 h-5 mr-4" /> {Languages.t('components.side_menu.my_drive')}
        </Button>
        {FeatureTogglesService.isActiveFeatureName(FeatureNames.COMPANY_SHARED_DRIVE) && (
          <Button
            onClick={() => {
              setParentId('root');
              history.push(
                RouterServices.generateRouteFromState({
                  companyId: company,
                  viewId: 'root',
                  itemId: '',
                  dirId: '',
                }),
              );
            }}
            size="lg"
            theme="white"
            className={
              'w-full mb-1 ' + (folderType === 'home' && viewId == 'root' ? activeClass : '')
            }
            testClassId="sidebar-menu-shared-drive"
          >
            <CloudIcon className="w-5 h-5 mr-4" /> {Languages.t('components.side_menu.home')}
          </Button>
        )}
        {FeatureTogglesService.isActiveFeatureName(FeatureNames.COMPANY_MANAGE_ACCESS) && (
          <Button
            onClick={() => {
              history.push(
                RouterServices.generateRouteFromState({
                  companyId: company,
                  viewId: 'shared_with_me',
                  itemId: '',
                  dirId: '',
                }),
              );
              // setParentId('shared_with_me');
            }}
            size="lg"
            theme="white"
            className={
              'w-full mb-1 ' +
              (folderType === 'shared' && viewId == 'shared_with_me' ? activeClass : '')
            }
            testClassId="sidebar-menu-share-with-me"
          >
            <UserGroupIcon className="w-5 h-5 mr-4" />{' '}
            {Languages.t('components.side_menu.shared_with_me')}
          </Button>
        )}
        {false && (
          <>
            <Button
              size="lg"
              theme="white"
              className={'w-full mb-1 ' + (!active ? activeClass : '')}
            >
              <ClockIcon className="w-5 h-5 mr-4" /> Recent
            </Button>
            <Button
              size="lg"
              theme="white"
              className={'w-full mb-1 ' + (!active ? activeClass : '')}
            >
              <HeartIcon className="w-5 h-5 mr-4" /> Favorites
            </Button>
          </>
        )}
        <Button
          onClick={() => {
            history.push(
              RouterServices.generateRouteFromState({
                companyId: company,
                viewId: 'trash_' + user?.id,
                itemId: '',
                dirId: '',
              }),
            );
            // setParentId('trash_' + user?.id);
          }}
          size="lg"
          theme="white"
          className={'w-full mb-1 ' + (viewId?.includes('trash') ? activeClass : '')}
          testClassId="sidebar-menu-trash"
        >
          <TrashIcon className="w-5 h-5 mr-4 text-rose-500" />{' '}
          {Languages.t('components.side_menu.trash')}
        </Button>

        {false && (
          <>
            <div className="mt-4" />
            <Title>Shared</Title>
            <Button
              size="lg"
              theme="white"
              className={'w-full mt-2 mb-1 ' + (!inTrash ? activeClass : '')}
            >
              <ShareIcon className="w-5 h-5 mr-4" /> Shared with me
            </Button>
            <Button
              size="lg"
              theme="white"
              className={'w-full mb-1 ' + (inTrash ? activeClass : '')}
            >
              <ExternalLinkIcon className="w-5 h-5 mr-4" /> Shared by me
            </Button>
          </>
        )}
      </div>

      <div className="">
        <DiskUsage />
      </div>
    </div>
  );
};
