import { ToasterService } from '@features/global/services/toaster-service';
import useRouterCompany from '@features/router/hooks/use-router-company';
import { useCallback } from 'react';
import { useRecoilValue, useRecoilCallback, useRecoilState } from 'recoil';
import { DriveApiClient } from '../api-client/api-client';
import { DriveItemAtom, DriveItemChildrenAtom, DriveItemPagination, DriveItemSort } from '../state/store';
import { BrowseFilter, DriveItem, DriveItemVersion } from '../types';
import { SharedWithMeFilterState } from '../state/shared-with-me-filter';
import Languages from 'features/global/services/languages-service';
import { useUserQuota } from 'features/users/hooks/use-user-quota';

/**
 * Returns the children of a drive item
 * @returns
 */
export const useDriveActions = (inPublicSharing?: boolean) => {
  const companyId = useRouterCompany();
  const sharedFilter = useRecoilValue(SharedWithMeFilterState);
  const sortItem = useRecoilValue(DriveItemSort);
  const [ paginateItem ] = useRecoilState(DriveItemPagination);
  const { getQuota } = useUserQuota();

  const refresh = useRecoilCallback(
    ({ set, snapshot }) =>
      async (parentId: string, resetPagination?: boolean) => {
        if (parentId) {
          const filter: BrowseFilter = {
            company_id: companyId,
            mime_type: sharedFilter.mimeType.value,
          };
          let pagination = await snapshot.getPromise(DriveItemPagination);

          if (resetPagination) {
            pagination = { page: 0, limit: pagination.limit };
            set(DriveItemPagination, pagination);
          }
          try {
            const details = await DriveApiClient.browse(companyId, parentId, filter, sortItem, pagination);
            set(DriveItemChildrenAtom(parentId), details.children);
            set(DriveItemAtom(parentId), details);
            for (const child of details.children) {
              const currentValue = snapshot.getLoadable(DriveItemAtom(child.id)).contents;
              if (!currentValue) {
                //only update if not already in cache to avoid concurrent updates
                set(DriveItemAtom(child.id), { item: child });
              }
            }
            return details;
          } catch (e) {
            ToasterService.error(Languages.t('hooks.use-drive-actions.unable_load_file'));
          } finally {
            set(DriveItemPagination, { page: pagination.limit, limit: pagination.limit });
          }
        }
      },
    [companyId, sortItem],
  );

  const create = useCallback(
    async (item: Partial<DriveItem>, version: Partial<DriveItemVersion>) => {
      if (!item || !version) throw new Error('All ');
      if (!item.company_id) item.company_id = companyId;

      try {
        const driveFile = await DriveApiClient.create(companyId, { item, version });

        await refresh(driveFile.parent_id, true);
        await getQuota();

        return driveFile;
      } catch (e: any) {
        if (e.statusCode === 403) {
          ToasterService.info(
            <>
              <p>{Languages.t('hooks.use-drive-actions.quota_limit_exceeded_title')}</p>
              <p>{Languages.t('hooks.use-drive-actions.quota_limit_exceeded_message')}</p>
              <p>{Languages.t('hooks.use-drive-actions.quota_limit_exceeded_plans')}</p>
            </>,
          );
        } else {
          ToasterService.error(Languages.t('hooks.use-drive-actions.unable_create_file'));
        }
        return null;
      }
    },
    [refresh],
  );

  const download = useCallback(
    async (id: string, versionId?: string) => {
      try {
        const url = DriveApiClient.getDownloadUrl(companyId, id, versionId);
        (window as any).open(url, '_blank').focus();
      } catch (e) {
        ToasterService.error(Languages.t('hooks.use-drive-actions.unable_download_file'));
      }
    },
    [companyId],
  );

  const downloadZip = useCallback(
    async (ids: string[], isDirectory = false) => {
      try {
        const url = await DriveApiClient.getDownloadZipUrl(companyId, ids, isDirectory);
        (window as any).open(url, '_blank').focus();
      } catch (e) {
        ToasterService.error(Languages.t('hooks.use-drive-actions.unable_download_file'));
      }
    },
    [companyId],
  );

  const remove = useCallback(
    async (id: string | string[], parentId: string) => {
      try {
        if (Array.isArray(id)) {
          await Promise.all(id.map(i => DriveApiClient.remove(companyId, i)));
        } else await DriveApiClient.remove(companyId, id);
        await refresh(parentId || '', true);
        await getQuota();
      } catch (e) {
        ToasterService.error(Languages.t('hooks.use-drive-actions.unable_remove_file'));
      }
    },
    [refresh],
  );

  const restore = useCallback(
    async (id: string, parentId: string) => {
      try {
        await DriveApiClient.restore(companyId, id);
        await refresh(parentId || '', true);
      } catch (e) {
        ToasterService.error(Languages.t('hooks.use-drive-actions.unable_restore_file'));
      }
    },
    [refresh],
  );

  const update = useCallback(
    async (update: Partial<DriveItem>, id: string, parentId: string, previousName?: string) => {
      try {
        const newItem = await DriveApiClient.update(companyId, id, update);
        if (previousName && previousName !== newItem.name && !update.name)
          ToasterService.warn(Languages.t('hooks.use-drive-actions.update_caused_a_rename', [previousName, newItem.name]));
        await refresh(id || '', true);
        if (!inPublicSharing) await refresh(parentId || '', true);
        if (update?.parent_id !== parentId) await refresh(update?.parent_id || '', true);
      } catch (e) {
        ToasterService.error(Languages.t('hooks.use-drive-actions.unable_update_file'));
      }
    },
    [refresh],
  );

  const updateLevel = useCallback(
    async (id: string, userId: string, level: string) => {
      try {
        const updateBody = {
          company_id: companyId,
          user_id: userId,
          level: level,
        };
        await DriveApiClient.updateLevel(companyId, id, updateBody);
        await refresh(id || '', true);
      } catch (e) {
        ToasterService.error(Languages.t('hooks.use-drive-actions.unable_update_file'));
      }
    },
    [refresh],
  );

  const nextPage = useRecoilCallback(
    ({ snapshot }) =>
      async (parentId: string) => {
        const filter: BrowseFilter = {
          company_id: companyId,
          mime_type: sharedFilter.mimeType.value,
        };
        const pagination = await snapshot.getPromise(DriveItemPagination);
        const details = await DriveApiClient.browse(
          companyId,
          parentId,
          filter,
          sortItem,
          pagination
        );
        return details;
      },
    [paginateItem, refresh],
  );

  return { create, refresh, download, downloadZip, remove, restore, update, updateLevel, nextPage };
};
