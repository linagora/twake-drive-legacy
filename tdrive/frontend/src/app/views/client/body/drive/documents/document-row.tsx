import { DotsHorizontalIcon } from '@heroicons/react/outline';
import { Button } from '@atoms/button/button';
import { Base, BaseSmall } from '@atoms/text';
import Menu from '@components/menus/menu';
import useRouterCompany from '@features/router/hooks/use-router-company';
import { useDrivePreview } from '@features/drive/hooks/use-drive-preview';
import { formatBytes } from '@features/drive/utils';
import { useEffect, useState } from 'react';
import { PublicIcon } from '../components/public-icon';
import { CheckableIcon, DriveItemOverlayProps, DriveItemProps } from './common';
import './style.scss';
import { useHistory } from 'react-router-dom';
import RouterServices from '@features/router/services/router-service';
import useRouteState from 'app/features/router/hooks/use-route-state';
import { DocumentIcon } from './document-icon';
import { hasAnyPublicLinkAccess } from '@features/files/utils/access-info-helpers';
import { formatDateShort } from 'app/features/global/utils/Numbers';

export const DocumentRow = ({
  item,
  className,
  onCheck,
  checked,
  onClick,
  onBuildContextMenu,
  inPublicSharing,
}: DriveItemProps) => {
  const history = useHistory();
  const [hover, setHover] = useState(false);
  const { open, close } = useDrivePreview();
  const company = useRouterCompany();
  const { itemId } = useRouteState();

  useEffect(() => {
    // close the preview if the item is not set or the user navigated away
    if (!itemId) {
      close();
    }
    // open the preview if the item is set
    if (itemId == item.id) {
      open(item);
    }
  }, [itemId]);

  const preview = () => {
    history.push(RouterServices.generateRouteFromState({ companyId: company, itemId: item.id }));
    if (inPublicSharing) open(item);
  };

  return (
    <div
      className={
        'flex flex-row items-center border border-zinc-200 dark:border-zinc-800 -mt-px px-4 py-3 cursor-pointer ' +
        (checked
          ? 'bg-blue-500 bg-opacity-10 hover:bg-opacity-25  '
          : 'hover:bg-zinc-500 hover:bg-opacity-10 ') +
        (className || '')
      }
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={e => {
        if (e.shiftKey || e.ctrlKey) onCheck(!checked);
        else if (onClick) onClick();
        else preview();
      }}
    >
      <div
        onClick={e => {
          e.stopPropagation();
        }}
      >
        <CheckableIcon
          className="mr-2 -ml-1"
          show={hover || checked}
          checked={checked}
          onCheck={onCheck}
          fallback={<DocumentIcon item={item} />}
        />
      </div>
      <div className="grow text-ellipsis whitespace-nowrap overflow-hidden">
        <Base className="flex maxWidth100">{item.name}</Base>
      </div>
      <div className="shrink-0 ml-4">
        {hasAnyPublicLinkAccess(item) && <PublicIcon className="h-5 w-5 text-blue-500" />}
      </div>
      <div className="shrink-0 ml-4 mr-12">
        <BaseSmall>{formatDateShort(item?.last_version_cache?.date_added)}</BaseSmall>
      </div>
      <div className="shrink-0 ml-4 text-right lg:w-24 sm:w-20 ">
        <BaseSmall>{formatBytes(item.size)}</BaseSmall>
      </div>
      <div className="shrink-0 ml-4">
        <Menu menu={onBuildContextMenu}>
          <Button
            theme={'secondary'}
            size="sm"
            className={'!rounded-full '}
            icon={DotsHorizontalIcon}
          />
        </Menu>
      </div>
    </div>
  );
};

export const DocumentRowOverlay = ({ item, className }: DriveItemOverlayProps) => {
  return (
    <div
      className={
        'flex flex-row items-center border border-zinc-200 dark:border-zinc-800 -mt-px px-4 py-3 cursor-pointer ' +
        (className || '')
      }
    >
      <div className="grow text-ellipsis whitespace-nowrap overflow-hidden">
        <Base>{item?.name}</Base>
      </div>
    </div>
  );
};
