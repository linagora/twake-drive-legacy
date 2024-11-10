import { Transition } from '@headlessui/react';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from '@heroicons/react/outline';
import { useEffect, useState } from 'react';
import { fadeTransition, fadeZoomTransition } from 'src/utils/transitions';
import Controls from './controls';
import Display from './display';
import Avatar from '@atoms/avatar';
import { Button } from '@atoms/button/button';
import { DownloadIcon } from '@atoms/icons-agnostic';
import { Loader } from '@atoms/loader';
import { Modal } from '@atoms/modal';
import * as Text from '@atoms/text';
import { addShortcut, removeShortcut } from '@features/global/services/shortcut-service';
import { formatSize } from '@features/global/utils/format-file-size';
import currentUserService from '@features/users/services/current-user-service';
import { UserType } from '@features/users/types/user';
import {
  useFileViewer,
  useViewerDataLoading,
  useViewerDisplayData,
} from '@features/viewer/hooks/use-viewer';

let animationTimeout: number = setTimeout(() => undefined);

export default () => {
  const { loading, isOpen } = useFileViewer();
  const [animatedLoading, setAnimatedLoading] = useState(true);
  const { loading: loadingData } = useViewerDataLoading();

  useEffect(() => {
    clearTimeout(animationTimeout);
    if (loading) {
      setAnimatedLoading(true);
    } else {
      animationTimeout = window.setTimeout(() => {
        setAnimatedLoading(false);
      }, 400);
    }
  }, [loading]);

  return (
    <Modal
      open={isOpen}
      closable={false}
      className="bg-black bg-opacity-50 !sm:max-w-none !w-full !rounded-none !p-0"
      style={{ maxWidth: 'none', margin: 0, left: 0, top: 0, height: '100vh' }}
      positioned={false}
    >
      <Navigation />

      <Transition
        show={animatedLoading || loadingData}
        as="div"
        className="absolute m-auto w-8 h-8 left-0 right-0 top-0 bottom-0"
        {...fadeTransition}
      >
        <Loader className="w-8 h-8 text-white" />
      </Transition>

      <Transition
        show={!animatedLoading}
        as="div"
        className="flex flex-col h-full"
        {...fadeTransition}
      >
        <div className="px-16 py-2 grow relative overflow-hidden">
          <Display />
        </div>
        <Footer />
      </Transition>
    </Modal>
  );
};

const Navigation = () => {
  const { close, status, next, previous } = useFileViewer();
  const { type } = useViewerDisplayData();

  useEffect(() => {
    addShortcut({ shortcut: 'esc', handler: close });
    addShortcut({ shortcut: 'right', handler: () => next() });
    addShortcut({ shortcut: 'left', handler: () => previous() });
    return () => {
      removeShortcut({ shortcut: 'esc', handler: close });
      removeShortcut({ shortcut: 'right', handler: () => next() });
      removeShortcut({ shortcut: 'left', handler: () => previous() });
    };
  }, []);

  const isMedia = ['audio', 'video', 'image'].includes(type || '');

  return (
    <>
      <XIcon
        className="z-10 cursor-pointer absolute right-5 top-5 w-12 h-12 text-zinc-300 hover:text-white rounded-full p-1 hover:bg-black hover:bg-opacity-25"
        onClick={() => close()}
      />

      <Transition
        as="div"
        show={!!status.details?.navigation?.previous && isMedia}
        className="z-10 absolute left-5 top-0 bottom-0 m-auto w-12 h-12 rounded-full p-1 hover:bg-black hover:bg-opacity-25"
        {...fadeZoomTransition}
      >
        <ChevronLeftIcon
          className="cursor-pointer w-10 h-10 text-zinc-300 hover:text-white"
          onClick={() => previous()}
        />
      </Transition>

      <Transition
        as="div"
        show={!!status.details?.navigation?.next && isMedia}
        className="z-10 absolute right-5 top-0 bottom-0 m-auto w-12 h-12 rounded-full p-1 hover:bg-black hover:bg-opacity-25"
        {...fadeZoomTransition}
      >
        <ChevronRightIcon
          className="cursor-pointer w-10 h-10 text-zinc-300 hover:text-white"
          onClick={() => next()}
        />
      </Transition>
    </>
  );
};

const Footer = () => {
  const { status } = useFileViewer();
  const { download } = useViewerDisplayData();
  const { type = '' } = useViewerDisplayData();
  const user = status?.details?.user as UserType;
  const name = status.details?.metadata?.name;
  const extension = name?.split('.').pop();

  return (
    <>
      <div className="z-10 p-5 bg-black w-full flex text-white">
        <div className="mr-4 w-12">
          <Avatar
            title={currentUserService.getFullName(user)}
            src={currentUserService.getThumbnail(user)}
          />
        </div>
        <div className="grow overflow-hidden text-ellipsis">
          <Text.Base noColor className="w-full block text-white whitespace-nowrap">
            {name}
          </Text.Base>
          <Text.Info className="whitespace-nowrap">
            {currentUserService.getFullName(user)} • {extension?.toLocaleUpperCase()},{' '}
            {formatSize(status.details?.metadata?.size)}
          </Text.Info>
        </div>

        <div className="whitespace-nowrap">
          <Controls type={type} />

          <Button
            iconSize="lg"
            className="ml-4 !rounded-full"
            theme="dark"
            size="lg"
            icon={DownloadIcon}
            onClick={() => {
              download && (window.location.href = download);
            }}
          />
        </div>
      </div>
    </>
  );
};
