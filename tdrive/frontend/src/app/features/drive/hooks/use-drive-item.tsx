import { ToasterService } from '@features/global/services/toaster-service';
import { LoadingStateInitTrue } from '@features/global/state/atoms/Loading';
import useRouterCompany from '@features/router/hooks/use-router-company';
import { useCallback, useEffect } from 'react';
import { useRecoilCallback, useRecoilState, useRecoilValue } from 'recoil';
import { DriveItemAtom, DriveItemChildrenAtom, DriveItemPagination } from '../state/store';
import { DriveItem } from '../types';
import { useDriveActions } from './use-drive-actions';
import { useDriveUpload } from './use-drive-upload';
import short from 'short-uuid';

/**
 * Get in store single item and expose methods to operate on it
 * @param id
 * @returns
 */
export const useDriveItem = (id: string) => {
  const companyId = useRouterCompany();
  const item = useRecoilValue(DriveItemAtom(id));
  // const children = useRecoilValue(DriveItemChildrenAtom(id));
  const [children, setChildren] = useRecoilState(DriveItemChildrenAtom(id));
  const [loading, setLoading] = useRecoilState(LoadingStateInitTrue('useDriveItem-' + id));
  const [paginateItem, setPaginateItem] = useRecoilState(DriveItemPagination);
  const {
    refresh: refreshItem,
    create,
    update: _update,
    updateLevel: _updateLevel,
    remove: _remove,
    restore: _restore,
    nextPage,
  } = useDriveActions();
  const { uploadVersion: _uploadVersion } = useDriveUpload();
  const refresh = useCallback(
    async (parentId: string, resetPagination?: boolean) => {
      setLoading(true);
      try {
        setPaginateItem(prev => ({ ...prev, page: 0 }));
        await refreshItem(parentId, resetPagination);
      } finally {
        setLoading(false);
      }
    },
    [id, setLoading, refreshItem],
  );

  const remove = useCallback(async () => {
    setLoading(true);
    try {
      await _remove(id, item?.item?.parent_id || '');
    } catch (e) {
      ToasterService.error('Unable to remove this file.');
    }
    setLoading(false);
  }, [id, setLoading, refresh, item?.item?.parent_id]);

  const restore = useCallback(async () => {
    setLoading(true);
    try {
      await _restore(id, item?.item?.parent_id || '');
    } catch (e) {
      ToasterService.error('Unable to restore this item.');
    }
    setLoading(false);
  }, [id, setLoading, refresh, item?.item?.parent_id]);

  const update = useCallback(
    async (update: Partial<DriveItem>, skipLoading = false) => {
      if (!skipLoading) setLoading(true);
      try {
        await _update(update, id, item?.item?.parent_id || '');
      } catch (e) {
        ToasterService.error('Unable to update this file.');
      }
      setLoading(false);
    },
    [id, setLoading, refresh, item?.item?.parent_id],
  );

  const updateLevel = useCallback(
    async (userId: string, level: string) => {
      setLoading(true);
      try {
        await _updateLevel(id, userId, level);
      } catch (e) {
        ToasterService.error('Unable to update user access.');
      }
      setLoading(false);
    },
    [id, setLoading, refresh, item?.item?.parent_id],
  );

  const uploadVersion = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        await _uploadVersion(file, { companyId, id });
      } catch (e) {
        ToasterService.error('Unable to create a new version of this file.');
      }
      setLoading(false);
    },
    [companyId, id, setLoading, refresh, item?.item?.parent_id],
  );

  const loadNextPage = useRecoilCallback(
    ({ set, snapshot }) =>
      async (id: string) => {
        // get current pagination state
        const pagination = await snapshot.getPromise(DriveItemPagination);

        // if end is true, do not load more
        if (pagination.lastPage === true) return;
        setLoading(true);

        try {
          const details = await nextPage(id);
          if (details.children.length === 0) {
            set(DriveItemPagination, prev => ({
              ...prev,
              lastPage: true,
            }));
          }
          // set children and remove duplicates
          setChildren(prev => {
            // Create a Map for existing IDs for fast lookups
            const existingIds = new Map(prev.map(item => [item.id, true]));

            // Filter children while adding them to the state
            return [...prev, ...details.children.filter(item => !existingIds.has(item.id))];
          });
        } catch (e) {
          // set pagination end to true
          set(DriveItemPagination, prev => ({
            ...prev,
            lastPage: true,
          }));
          console.log('error loading next page: ', e);
          ToasterService.error('Unable to load more items.');
        } finally {
          set(DriveItemPagination, prev => ({
            ...prev,
            page: prev.page + prev.limit,
          }));
        }
        setLoading(false);
      },
    [id, nextPage],
  );

  const inTrash =
    id.includes('trash') ||
    item?.path?.some(i => i?.parent_id?.includes('trash')) ||
    item?.item?.is_in_trash;
  const sharedWithMe = id == 'shared_with_me';

  useEffect(() => {
    if (id) {
      refresh(id, true); // Re-fetch from backend and update Recoil state
    }
  }, [id, refresh]);

  return {
    sharedWithMe,
    inTrash,
    loading: loading,
    children: children || [],
    details: item,
    path: item?.path,
    item: item?.item,
    access: item?.access,
    websockets: item?.websockets,
    versions: item?.versions,
    uploadVersion,
    create,
    update,
    updateLevel,
    remove,
    refresh,
    restore,
    paginateItem,
    loadNextPage,
  };
};

const translator = short();
export const getPublicLink = (item?: DriveItem): string => {
  let publicLink = `${document.location.protocol}//${document.location.host}`;
  try {
    publicLink +=
      `/shared/${translator.fromUUID(item?.company_id || '')}` +
      `/drive/${translator.fromUUID(item?.id || '')}` +
      `/t/${item?.access_info?.public?.token}`;
  } catch (e) {
    return publicLink;
  }

  return publicLink;
};
