import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Transition } from '@headlessui/react';
import { fadeTransition } from 'src/utils/transitions';
import { DownloadIcon, XIcon, ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/outline';
import { addShortcut, removeShortcut } from '@features/global/services/shortcut-service';
import RouterServices from '@features/router/services/router-service';
import useRouterCompany from '@features/router/hooks/use-router-company';
import {
  useDrivePreview,
  useDrivePreviewDisplayData,
  useDrivePreviewLoading,
} from '@features/drive/hooks/use-drive-preview';
import { formatSize } from '@features/global/utils/format-file-size';
import { formatDate } from '@features/global/utils/format-date';
import { DriveItem } from 'app/features/drive/types';
import { Modal } from '@atoms/modal';
import { Button } from '@atoms/button/button';
import { Loader } from '@atoms/loader';
import * as Text from '@atoms/text';
import DriveDisplay from './drive-display';
import Controls from './controls';

interface DrivePreviewProps {
  items: DriveItem[];
}

export const DrivePreview: React.FC<DrivePreviewProps> = ({ items }) => {
  const history = useHistory();
  const company = useRouterCompany();
  const { status, isOpen, open, close, loading } = useDrivePreview();
  const [modalLoading, setModalLoading] = useState(true);
  const { loading: loadingData } = useDrivePreviewLoading();
  let animationTimeout: number = setTimeout(() => undefined);

  const { download, extension } = useDrivePreviewDisplayData();
  const { type = '' } = useDrivePreviewDisplayData();
  const name = status.details?.item.name;


  const handleSwitchRight = () => {
    const currentItem = status.item;
    if (currentItem) {
      const currentItemPos = items.findIndex(x => x.id === currentItem.id);
      switchPreview(items[(currentItemPos + 1) % items.length]);
    }
  };

  const handleSwitchLeft = () => {
    const currentItem = status.item;
    if (currentItem) {
      const currentItemPos = items.findIndex(x => x.id === currentItem.id);
      switchPreview(items[(currentItemPos - 1 + items.length) % items.length]);
    }
  };

  useEffect(() => {
    addShortcut({ shortcut: 'esc', handler: close });

    return () => {
      removeShortcut({ shortcut: 'esc', handler: close });
    };
  }, []);

  useEffect(() => {
    addShortcut({ shortcut: 'Right', handler: handleSwitchRight });
    addShortcut({ shortcut: 'Left', handler: handleSwitchLeft });

    return () => {
      removeShortcut({ shortcut: 'Right', handler: handleSwitchRight });
      removeShortcut({ shortcut: 'Left', handler: handleSwitchLeft });
    };
  }, [status]);

  useEffect(() => {
    clearTimeout(animationTimeout);

    if (loading) {
      animationTimeout = window.setTimeout(() => {
        setModalLoading(false);
      }, 100);
    }
  }, [loading]);

  const switchPreview = async (item: DriveItem) => {
    close();
    //TODO[ASH] fix state management for this component
    //right now changing the routing leads to a lot of components rerender
    //and galery become unusable
    // history.push(
    //   RouterServices.generateRouteFromState({ companyId: company, itemId: item.id, }),
    // );
    open(item);
  };
  return (
    <Modal
      open={isOpen}
      closable={false}
      className="bg-black bg-opacity-50 !sm:max-w-none !w-full !rounded-none !p-0"
      style={{ maxWidth: 'none', margin: 0, left: 0, top: 0, height: '100vh' }}
      positioned={false}
    >
      <XIcon
        className="z-10 cursor-pointer absolute right-5 top-5 w-20 h-20 text-white hover:text-black rounded-full p-1 bg-gray-500 hover:bg-white bg-opacity-25"
        onClick={() => {
          close();
          history.push(RouterServices.generateRouteFromState({ companyId: company,  itemId: '' }));
        }}
      />

      <Transition
        show={modalLoading || loadingData}
        as="div"
        className="absolute m-auto w-8 h-8 left-0 right-0 top-0 bottom-0"
        {...fadeTransition}
      >
        <Loader className="w-8 h-8 text-white" />
      </Transition>

      <Transition
        show={!modalLoading}
        as="div"
        className="flex flex-col h-full"
        {...fadeTransition}
      >
        <div className="px-16 py-2 grow relative overflow-hidden">
          <DriveDisplay />
        </div>
        <div className="z-10 p-5 bg-black w-full flex text-white">
          <div className="grow overflow-hidden text-ellipsis">
            <Text.Base noColor className="w-full block text-white whitespace-nowrap">
              {name}
            </Text.Base>
            <Text.Info className="whitespace-nowrap">
              {formatDate(
                +(status.details?.item.added || '') ||
                status.details?.item.last_version_cache.date_added,
              )}{' '}
              • {extension?.toLocaleUpperCase()},{' '}
              {formatSize(
                status.details?.item.last_version_cache.file_metadata.size ||
                status.details?.item.size,
              )}
            </Text.Info>
          </div>
          <div className="whitespace-nowrap flex items-center">
            <Controls type={type} />
            <Button
              iconSize="lg"
              className="ml-4 !rounded-full"
              theme="dark"
              size="lg"
              icon={ArrowLeftIcon}
              onClick={ handleSwitchLeft }
            />
            <Button
              iconSize="lg"
              className="ml-4 !rounded-full"
              theme="dark"
              size="lg"
              icon={ArrowRightIcon}
              onClick={ handleSwitchRight }
            />
            <Button
              iconSize="lg"
              className="ml-4 !rounded-full"
              theme="dark"
              size="lg"
              icon={DownloadIcon}
              onClick= {() => {
                download && (window.location.href = download);
              }}
            />
          </div>
        </div>
      </Transition>
    </Modal>
  );
};