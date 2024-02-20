import { ToasterService } from '@features/global/services/toaster-service';
import useRouterCompany from '@features/router/hooks/use-router-company';
import { useCallback } from 'react';
import { useRecoilValue, useRecoilCallback } from 'recoil';
import { DriveApiClient } from '../api-client/api-client';
import { DriveItemAtom, DriveItemChildrenAtom } from '../state/store';
import { BrowseFilter, DriveItem, DriveItemVersion } from '../types';
import { SharedWithMeFilterState } from '../state/shared-with-me-filter';
import Languages from 'features/global/services/languages-service';
import { useUserQuota } from "features/users/hooks/use-user-quota";

/**
 * Returns the children of a drive item
 * @returns
 */
export const useDriveActions = () => {
  const companyId = useRouterCompany();
  const sharedFilter = useRecoilValue(SharedWithMeFilterState);
  const { getQuota } = useUserQuota();

  const refresh = useRecoilCallback(
    ({ set, snapshot }) =>
      async (parentId: string) => {
        if (parentId) {
          const filter: BrowseFilter = {
            company_id: companyId,
            mime_type: sharedFilter.mimeType.value,
          };
          try {
            const details = await DriveApiClient.browse(companyId, parentId, filter);
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
          }
        }
      },
    [companyId],
  );

  const create = useCallback(
    async (item: Partial<DriveItem>, version: Partial<DriveItemVersion>) => {
      if (!item || !version) throw new Error("All ");
      let driveFile = null;
      if (!item.company_id) item.company_id = companyId;
      try {
        driveFile = await DriveApiClient.create(companyId, { item, version });
        await refresh(driveFile.parent_id!);
        await getQuota();
      } catch (e) {
        ToasterService.error(Languages.t('hooks.use-drive-actions.unable_create_file'));
      }
      return driveFile;
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
    async (ids: string[]) => {
      try {
        const url = await DriveApiClient.getDownloadZipUrl(companyId, ids);
        (window as any).open(url, '_blank').focus();
      } catch (e) {
        ToasterService.error(Languages.t('hooks.use-drive-actions.unable_download_file'));
      }
    },
    [companyId],
  );

  const remove = useCallback(
    async (id: string, parentId: string) => {
      try {
        await DriveApiClient.remove(companyId, id);
        await refresh(parentId || '');
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
        await refresh(parentId || '');
      } catch (e) {
        ToasterService.error(Languages.t('hooks.use-drive-actions.unable_restore_file'));
      }
    },
    [refresh],
  );

  const update = useCallback(
    async (update: Partial<DriveItem>, id: string, parentId: string) => {
      try {
        await DriveApiClient.update(companyId, id, update);
        await refresh(id || '');
        await refresh(parentId || '');
        if (update?.parent_id !== parentId) await refresh(update?.parent_id || '');
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
          level: level
        }
        await DriveApiClient.updateLevel(companyId, id, updateBody);
        await refresh(id || '');
      } catch (e) {
        ToasterService.error(Languages.t('hooks.use-drive-actions.unable_update_file'));
      }
    },
    [refresh],
  );

  return { create, refresh, download, downloadZip, remove, restore, update, updateLevel };
};
