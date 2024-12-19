// eslint-disable-next-line @typescript-eslint/no-use-before-define
import classNames from 'classnames';
import React, { Suspense, useState } from 'react';

import UploadsViewer from '@components/file-uploads/uploads-viewer';
import { useFeatureToggles } from '@components/locked-features-components/feature-toggles-hooks';
import MenusBodyLayer from '@components/menus/menus-body-layer.jsx';
import ModalComponent from '@components/modal/modal-component';
import PopupService from '@deprecated/popupManager/popupManager.js';
import useUsetiful from '@features/global/hooks/use-usetiful';
import Languages from '@features/global/services/languages-service';
import { useCurrentUser } from '@features/users/hooks/use-current-user';
import UserContext from '@features/users/state/integration/user-context';
import Viewer from '@views/client/viewer/viewer';
import ConnectionIndicator from 'components/connection-indicator/connection-indicator';
import NewVersionComponent from 'components/new-version/new-version-component';
import PopupComponent from 'components/popup-component/popup-component.jsx';
import SearchPopup from 'components/search-popup/search-popup';
import MainView from './body';

import DownloadAppBanner from '@components/download-app-banner/download-app-banner';
import DesktopRedirect from '../../components/desktop-redirect';
import Header from './header';
import SideBar from './side-bar';

export default React.memo((): JSX.Element => {
  const [menuIsOpen, setMenuIsOpen] = useState(false);
  const { user } = useCurrentUser();
  const { FeatureToggles, activeFeatureNames } = useFeatureToggles();

  useUsetiful();

  PopupService.useListener();
  Languages.useListener();

  let page: JSX.Element = <></>;

  if (user?.id) {
    page = (
      <DesktopRedirect>
        <div className="fade_in bg-zinc-100 dark:bg-black flex flex-col gap-2 h-full testid:header">
          <DownloadAppBanner/>
          <NewVersionComponent />

          <FeatureToggles features={activeFeatureNames}>
            <>
              <Header openSideMenu={() => setMenuIsOpen(true)} />
              <div className="grow flex flex-row grid-cols-2 sm:px-2 sm:pb-2 overflow-hidden">
                <div
                  style={
                    menuIsOpen
                      ? {
                          transform: 'translateX(0)',
                        }
                      : {}
                  }
                  className="flex sm:rounded-lg sm:relative sm:translate-x-0 sm:w-1/3 absolute left-0 top-0 h-full -translate-x-full bg-white dark:bg-zinc-900 mr-2 rounded-none max-w-xs w-full p-4 transition-all z-50"
                >
                  <Suspense fallback={<></>}>
                    <SideBar />
                  </Suspense>
                </div>
                <div
                  style={
                    menuIsOpen
                      ? {
                          opacity: '1',
                        }
                      : {
                          pointerEvents: 'none',
                        }
                  }
                  onClick={() => setMenuIsOpen(false)}
                  className="absolute left-0 top-0 h-full w-full bg-black bg-opacity-50 transition-all z-40 opacity-0"
                ></div>
                <div className="bg-white dark:bg-zinc-900 flex grow sm:rounded-lg sm:w-2/3 overflow-x-hidden p-0 md:p-4">
                  <Suspense fallback={<></>}>
                    <MainView className={classNames({ collapsed: menuIsOpen })} />
                  </Suspense>
                </div>
              </div>
            </>
          </FeatureToggles>
          <UserContext />
        </div>
      </DesktopRedirect>
    );
  }

  return (
    <>
      {PopupService.isOpen() && <PopupComponent key="PopupComponent" />}
      {page}
      <MenusBodyLayer />
      <Viewer />
      <ModalComponent />
      <SearchPopup />
      <ConnectionIndicator />
      <UploadsViewer />
    </>
  );
});
