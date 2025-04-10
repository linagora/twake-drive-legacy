import {
  DotsHorizontalIcon,
  ShieldExclamationIcon,
  BanIcon,
} from '@heroicons/react/outline';
import { Button } from '@atoms/button/button';
import { Base, BaseSmall } from '@atoms/text';
import Menu from '@components/menus/menu';
import useRouterCompany from '@features/router/hooks/use-router-company';
import { useDrivePreview } from '@features/drive/hooks/use-drive-preview';
import { formatBytes } from '@features/drive/utils';
import Languages from '@features/global/services/languages-service';
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
import { Tooltip } from 'antd';

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

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return (
    <div
      className={
        'flex flex-row items-center border border-zinc-200 dark:border-zinc-800 px-4 py-3 cursor-pointer ' +
        (checked
          ? (notSafe ? 'bg-rose-500' : 'bg-blue-500') + ' bg-opacity-10 hover:bg-opacity-25'
          : 'hover:bg-zinc-500 hover:bg-opacity-10 ') +
        (className || '') + ' ' +
        'testid:document-row'
      }
      id={`DR-${item.id}`}
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
        <Base className={`block text-ellipsis whitespace-nowrap overflow-hidden max-w-full`}>{item.name}</Base>
      </div>
      <div className="shrink-0 md:ml-4">
        {hasAnyPublicLinkAccess(item) && <PublicIcon className="h-5 w-5 ml-4 text-gray-500 md:text-blue-500" />}
      </div>
      <div className="shrink-0 ml-4 md:mr-12 hidden md:block">
        <BaseSmall>{formatDateShort(item?.last_version_cache?.date_added)}</BaseSmall>
      </div>
      <div className="shrink-0 ml-4 mr-4 md:mr-none text-right lg:w-24 sm:w-20 ">
        <BaseSmall className="text-gray-500 dark:md:text-white md:text-black">{formatBytes(item.size)}</BaseSmall>
      </div>
      {FeatureTogglesService.isActiveFeatureName(FeatureNames.COMPANY_AV_ENABLED) && (
        <div className="shrink-0 ml-4 text-right lg:w-24 sm:w-20 ">
          <Tooltip className="w-5 block" placement="top" title={Languages.t(`scenes.app.drive.document_row.av_${item?.av_status}_hint`)}>
            {item?.av_status === 'malicious' && (
              <ShieldExclamationIcon className="w-5 text-rose-400" />
            )}
            {item?.av_status === 'skipped' && <BanIcon className="w-5 text-gray-400" />}
            {item?.av_status === 'scan_failed' && <BanIcon className="w-5 text-gray-400" />}
          </Tooltip>
        </div>
      )}
      <div className="shrink-0 ml-auto md:ml-4">
        <Menu menu={onBuildContextMenu} enableMobileMenu={isMobile} testClassId="document-row-menu">
          <Button
            theme={'secondary'}
            size="sm"
            className={'!rounded-full !text-gray-500 md:!text-blue-500 bg-transparent md:bg-blue-500 md:bg-opacity-25 '}
            icon={DotsHorizontalIcon}
            testClassId="document-row-button-open-menu"
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
