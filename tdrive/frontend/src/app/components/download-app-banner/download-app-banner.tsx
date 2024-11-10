import React, { useEffect, useState } from 'react';
// import InitService from '../../features/global/services/init-service';
import LocalStorage from '../../features/global/framework/local-storage-service';
import { detectDesktopAppPresence } from '../../../utils/browser-detect';

export default (): React.ReactElement => {
  const [ , setShowBanner] = useState(false);

  // const download = (): void => {
  //   const appDownloadUrl = InitService?.server_infos?.configuration?.app_download_url;
  //   if (appDownloadUrl)
  //     window.open(appDownloadUrl, '_blank');
  // };

  // const removeBanner = (): void => {
  //   LocalStorage.setItem('show_app_banner', 'false');
  //   setShowBanner(false);
  // };

  useEffect(() => {
    if (LocalStorage.getItem('show_app_banner') === 'false') {
      setShowBanner(false);
      return;
    }

    detectDesktopAppPresence().then(detected => {
      if (!detected && LocalStorage.getItem('show_app_banner') === null) {
        setShowBanner(true);
      } else {
        LocalStorage.setItem('show_app_banner', 'false');
      }
    });
  }, []);

  return <></>;
  // return showBanner ? <DownloadBanner onBannerClose={removeBanner} download={download} /> : <></>;
};
