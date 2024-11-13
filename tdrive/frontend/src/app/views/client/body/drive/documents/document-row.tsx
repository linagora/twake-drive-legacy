import {
  DotsHorizontalIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  BanIcon,
} from '@heroicons/react/outline';
import { Button } from '@atoms/button/button';
import { Base, BaseSmall } from '@atoms/text';
import Menu from '@components/menus/menu';
import useRouterCompany from '@features/router/hooks/use-router-company';
import { useDrivePreview } from '@features/drive/hooks/use-drive-preview';
import { formatBytes } from '@features/drive/utils';
import { useState } from 'react';
import { PublicIcon } from '../components/public-icon';
import { CheckableIcon, DriveItemOverlayProps, DriveItemProps } from './common';
import './style.scss';
import { useHistory } from 'react-router-dom';
import RouterServices from '@features/router/services/router-service';
import { DocumentIcon } from './document-icon';
import { hasAnyPublicLinkAccess } from '@features/files/utils/access-info-helpers';
import { formatDateShort } from 'app/features/global/utils/Numbers';
import FeatureTogglesService, {
  FeatureNames,
} from '@features/global/services/feature-toggles-service';

export const DocumentRow = ({
  item,
  className,
  onCheck,
  checked,
  onClick,
  onBuildContextMenu,
}: DriveItemProps) => {
  const history = useHistory();
  const [hover, setHover] = useState(false);
  const {open} = useDrivePreview();
  const company = useRouterCompany();
  const notSafe = ['malicious', 'skipped', 'scan_failed'].includes(item.av_status);

  const preview = () => {
    open(item);
    history.push(RouterServices.generateRouteFromState({ companyId: company, itemId: item.id }));
    // history.push(RouterServices.generateRouteFromState({ companyId: company, itemId: item.id }));
  };

  return (
    <div
      className={
        'flex flex-row items-center border border-zinc-200 dark:border-zinc-800 px-4 py-3 cursor-pointer ' +
        (checked
          ? (notSafe ? 'bg-rose-500' : 'bg-blue-500') + ' bg-opacity-10 hover:bg-opacity-25'
          : 'hover:bg-zinc-500 hover:bg-opacity-10 ') +
        (className || '')
      }
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={e => {
        if (e.shiftKey || e.ctrlKey) onCheck(!checked);
        else if (onClick) onClick();
        else {
          if (!notSafe) preview();
        }
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
      {FeatureTogglesService.isActiveFeatureName(FeatureNames.COMPANY_AV_ENABLED) && (
        <div className="shrink-0 ml-4 text-right lg:w-24 sm:w-20 ">
          <BaseSmall title={item?.av_status}>
            {item?.av_status === 'safe' && <ShieldCheckIcon className="w-5 text-teal-400" />}
            {item?.av_status === 'scanning' && (
              <ShieldExclamationIcon className="w-5 text-yellow-400" />
            )}
            {item?.av_status === 'malicious' && (
              <ShieldExclamationIcon className="w-5 text-rose-400" />
            )}
            {item?.av_status === 'skipped' && <BanIcon className="w-5 text-gray-400" />}
            {item?.av_status === 'scan_failed' && <BanIcon className="w-5 text-gray-400" />}
          </BaseSmall>
        </div>
      )}
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
        'flex flex-row items-center border border-zinc-200 dark:border-zinc-800 px-4 py-3 cursor-pointer ' +
        (className || '')
      }
    >
      <div className="grow text-ellipsis whitespace-nowrap overflow-hidden">
        <Base>{item?.name}</Base>
      </div>
    </div>
  );
};
