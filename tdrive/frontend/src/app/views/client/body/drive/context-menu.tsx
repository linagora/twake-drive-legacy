import { useState, useCallback } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { DriveCurrentFolderAtom } from './browser';
import { ConfirmDeleteModalAtom } from './modals/confirm-delete';
import { ConfirmTrashModalAtom } from './modals/confirm-trash';
import { CreateModalAtom } from './modals/create';
import { UploadModelAtom } from './modals/upload'
import { PropertiesModalAtom } from './modals/properties';
import { SelectorModalAtom } from './modals/selector';
import { AccessModalAtom } from './modals/update-access';
import { PublicLinkModalAtom } from './modals/public-link';
import { VersionsModalAtom } from './modals/versions';
import { UsersModalAtom } from './modals/manage-users';
import { DriveApiClient, getPublicLinkToken } from '@features/drive/api-client/api-client';
import { useDriveActions } from '@features/drive/hooks/use-drive-actions';
import { getPublicLink } from '@features/drive/hooks/use-drive-item';
import { useDrivePreview } from '@features/drive/hooks/use-drive-preview';
import { DriveItemSelectedList, DriveItemSort } from '@features/drive/state/store';
import { DriveItem, DriveItemDetails } from '@features/drive/types';
import { ToasterService } from '@features/global/services/toaster-service';
import { copyToClipboard } from '@features/global/utils/CopyClipboard';
import { SharedWithMeFilterState } from '@features/drive/state/shared-with-me-filter';
import { getCurrentUserList } from '@features/users/hooks/use-user-list';
import useRouteState from 'app/features/router/hooks/use-route-state';
import RouterServices from '@features/router/services/router-service';
import useRouterCompany from '@features/router/hooks/use-router-company';
import _, { set } from 'lodash';
import Languages from 'features/global/services/languages-service';
import { hasAnyPublicLinkAccess } from '@features/files/utils/access-info-helpers';

/**
 * This will build the context menu in different contexts
 */
export const useOnBuildContextMenu = (children: DriveItem[], initialParentId?: string) => {
  const [checkedIds, setChecked] = useRecoilState(DriveItemSelectedList);
  const checked = children.filter(c => checkedIds[c.id]);

  const [_, setParentId] = useRecoilState(
    DriveCurrentFolderAtom({ initialFolderId: initialParentId || 'root' }),
  );

  const { download, downloadZip, update, restore } = useDriveActions();
  const setCreationModalState = useSetRecoilState(CreateModalAtom);
  const setUploadModalState = useSetRecoilState(UploadModelAtom);
  const setSelectorModalState = useSetRecoilState(SelectorModalAtom);
  const setConfirmDeleteModalState = useSetRecoilState(ConfirmDeleteModalAtom);
  const setConfirmTrashModalState = useSetRecoilState(ConfirmTrashModalAtom);
  const setVersionModal = useSetRecoilState(VersionsModalAtom);
  const setAccessModalState = useSetRecoilState(AccessModalAtom);
  const setPublicLinkModalState = useSetRecoilState(PublicLinkModalAtom);
  const setPropertiesModalState = useSetRecoilState(PropertiesModalAtom);
  const setUsersModalState = useSetRecoilState(UsersModalAtom);
  const { open: preview } = useDrivePreview();
  const { viewId } = useRouteState();
  const company = useRouterCompany();

  function getIdsFromArray(arr: DriveItem[]): string[] {
    return arr.map((obj) => obj.id);
  }

  return useCallback(
    async (parent?: Partial<DriveItemDetails> | null, item?: DriveItem) => {
      if (!parent || !parent.access) return [];

      try {
        const inTrash = parent.path?.[0]?.id.includes('trash') || viewId?.includes("trash");
        const isPersonal = item?.scope === 'personal';
        const selectedCount = checked.length;

        let menu: any[] = [];

        if (item && selectedCount < 2) {
          //Add item related menus
          const upToDateItem = await DriveApiClient.get(item.company_id, item.id);
          const access = upToDateItem.access || 'none';
          const newMenuActions = [
            {
              type: 'menu',
              icon: 'share-alt',
              text: Languages.t('components.item_context_menu.share'),
              hide: access === 'read' || getPublicLinkToken() || inTrash,
              onClick: () => setPublicLinkModalState({ open: true, id: item.id }),
            },
            {
              type: 'menu',
              icon: 'users-alt',
              text: Languages.t('components.item_context_menu.manage_access'),
              hide: access === 'read' || getPublicLinkToken() || inTrash,
              onClick: () => setAccessModalState({ open: true, id: item.id }),
            },
            { type: 'separator' },
            {
              type: 'menu',
              icon: 'download-alt',
              text: Languages.t('components.item_context_menu.download'),
              onClick: () => {
                if (item && item.is_directory) {
                  downloadZip([item!.id]);
                  console.log(item!.id);
                } else {
                  download(item.id);
                }
              }
            },
            {
              type: 'menu',
              icon: 'eye',
              text: Languages.t('components.item_context_menu.open_new_window'),
              onClick: () => {
                const itemId = !item.is_directory ? item.id : "";
                const viewId = item.is_directory ? item.id : item.parent_id;
                const route = RouterServices.generateRouteFromState({ companyId: company, viewId, itemId });
                window.open(route, '_blank');
              }
            },
            { type: 'separator' },
            {
              type: 'menu',
              icon: 'folder-question',
              text: Languages.t('components.item_context_menu.move'),
              hide: access === 'read' || inTrash,
              onClick: () =>
                setSelectorModalState({
                  open: true,
                  parent_id: inTrash ? 'root' : item.parent_id,
                  mode: 'move',
                  title:
                    Languages.t('components.item_context_menu.move.modal_header') +
                    ` '${item.name}'`,
                  onSelected: async ids => {
                    await update(
                      {
                        parent_id: ids[0],
                      },
                      item.id,
                      item.parent_id,
                    );
                  },
                }),
            },
            {
              type: 'menu',
              icon: 'file-edit-alt',
              text: Languages.t('components.item_context_menu.rename'),
              hide: access === 'read' || inTrash,
              onClick: () => setPropertiesModalState({ open: true, id: item.id }),
            },
            {
              type: 'menu',
              icon: 'link',
              text: Languages.t('components.item_context_menu.copy_link'),
              hide: !item.access_info.public?.level || item.access_info.public?.level === 'none' || inTrash,
              onClick: () => {
                copyToClipboard(getPublicLink(item || parent?.item));
                ToasterService.success(
                  Languages.t('components.item_context_menu.copy_link.success'),
                );
              },
            },
            {
              type: 'menu',
              icon: 'history',
              text: Languages.t('components.item_context_menu.versions'),
              hide: item.is_directory || inTrash,
              onClick: () => setVersionModal({ open: true, id: item.id }),
            },
            { type: 'separator', hide: access !== 'manage' || inTrash, },
            {
              type: 'menu',
              icon: 'trash',
              text: Languages.t('components.item_context_menu.move_to_trash'),
              className: 'error',
              hide: inTrash || access !== 'manage',
              onClick: () => setConfirmTrashModalState({ open: true, items: [item] }),
            },
            {
              type: 'menu',
              text: Languages.t('components.item_context_menu.restore'),
              className: 'error',
              hide: !inTrash || (access !== 'manage' && !isPersonal),
              onClick: () => {
                const parentId = item.is_in_trash ? viewId || '' : item.parent_id;
                restore(item.id, parentId);
              },
            },
            {
              type: 'menu',
              text: Languages.t('components.item_context_menu.delete'),
              className: 'error',
              hide: !inTrash || access !== 'manage',
              onClick: () => setConfirmDeleteModalState({ open: true, items: [item] }),
            },
          ];
          if (newMenuActions.filter(a => !a.hide).length) {
            menu = [...newMenuActions];
          }
        }

        if (selectedCount && (selectedCount >= 2 || !item)) {
          // Add selected items related menus
          const newMenuActions: any[] = [
            {
              type: 'menu',
              text: Languages.t('components.item_context_menu.move_multiple'),
              hide: parent.access === 'read',
              onClick: () =>
                setSelectorModalState({
                  open: true,
                  parent_id: inTrash ? 'root' : parent.item!.id,
                  title: Languages.t('components.item_context_menu.move_multiple.modal_header'),
                  mode: 'move',
                  onSelected: async ids => {
                    for (const item of checked) {
                      await update(
                        {
                          parent_id: ids[0],
                        },
                        item.id,
                        item.parent_id,
                      );
                    }
                    setChecked({});
                  },
                }),
            },
            {
              type: 'menu',
              text: Languages.t('components.item_context_menu.download_multiple'),
              onClick: () =>
                selectedCount === 1 ? download(checked[0].id) : downloadZip(checked.map(c => c.id)),
            },
            {
              type: 'menu',
              text: Languages.t('components.item_context_menu.clear_selection'),
              onClick: () => setChecked({}),
            },
            { type: 'separator', hide: parent.access === 'read' },
            {
              type: 'menu',
              text: Languages.t('components.item_context_menu.delete_multiple'),
              hide: !inTrash || parent.access !== 'manage',
              className: 'error',
              onClick: () => {
                setConfirmDeleteModalState({
                  open: true,
                  items: checked,
                });
              },
            },
            {
              type: 'menu',
              text: Languages.t('components.item_context_menu.to_trash_multiple'),
              hide: inTrash || parent.access !== 'manage',
              className: 'error',
              onClick: async () =>
                setConfirmTrashModalState({
                  open: true,
                  items: checked,
                }),
            },
          ];
          if (menu.length && newMenuActions.filter(a => !a.hide).length) {
            menu = [...menu, { type: 'separator' }];
          }
          menu = [...menu, ...newMenuActions];
        } else if (!item) {
          //Add parent related menus
          const newMenuActions: any[] = inTrash
            ? [
                {
                  type: 'menu',
                  text: Languages.t('components.item_context_menu.trash.exit'),
                  onClick: () => setParentId('root'),
                },
                { type: 'separator' },
                {
                  type: 'menu',
                  text: Languages.t('components.item_context_menu.trash.empty'),
                  className: 'error',
                  hide: !inTrash,
                  onClick: () => {
                    setConfirmDeleteModalState({
                      open: true,
                      items: children, //Fixme: Here it works because this menu is displayed only in the trash root folder
                    });
                  },
                },
              ]
            : [
                {
                  type: 'menu',
                  text: Languages.t('components.item_context_menu.add_documents'),
                  hide: inTrash || parent.access === 'read',
                  onClick: () =>
                    parent?.item?.id &&
                    setUploadModalState({ open: true, parent_id: parent?.item?.id }),
                },
                {
                  type: 'menu',
                  text: Languages.t('components.item_context_menu.download_folder'),
                  hide: inTrash,
                  onClick: () => {
                    if (parent.children && parent.children.length > 0) {
                      downloadZip([parent.item!.id]);
                    } else if (parent.item) {
                      console.log("Download folder itself");
                      download(parent.item.id);
                    } else {
                      console.error("Very strange, everything is null, you are trying to download undefined");
                    }
                  },
                },
                {
                  type: 'menu',
                  text: Languages.t('components.item_context_menu.copy_link'),
                  hide: !hasAnyPublicLinkAccess(item),
                  onClick: () => {
                    copyToClipboard(getPublicLink(item || parent?.item));
                    ToasterService.success(
                      Languages.t('components.item_context_menu.copy_link.success'),
                    );
                  },
                },
                { type: 'separator', hide: parent.item!.id != 'root', },
                {
                  type: 'menu',
                  text: Languages.t('components.item_context_menu.manage_users'),
                  hide: parent.item!.id != 'root',
                  onClick: () => setUsersModalState({ open: true }),
                }
              ];
          if (menu.length && newMenuActions.filter(a => !a.hide).length) {
            menu = [...menu, { type: 'separator' }];
          }
          menu = [...menu, ...newMenuActions];
        }

        return menu;
      } catch (e) {
        console.error(e);
        ToasterService.error('An error occurred');
      }
      return [];
    },
    [
      checked,
      setChecked,
      setSelectorModalState,
      setConfirmDeleteModalState,
      setConfirmTrashModalState,
      download,
      downloadZip,
      update,
      preview,
      setParentId,
      setCreationModalState,
      setUploadModalState,
      setVersionModal,
      setAccessModalState,
      setPropertiesModalState,
    ],
  );
};

export const useOnBuildFileTypeContextMenu = () => {
  const [filter, setFilter] = useRecoilState(SharedWithMeFilterState);
  const mimeTypes = [
    { key: Languages.t('components.item_context_menu.all'), value: '' },
    { key: 'CSV', value: 'text/csv' },
    { key: 'DOC', value: 'application/msword' },
    { key: 'GIF', value: 'image/gif' },
    { key: 'JPEG', value: 'image/jpeg' },
    { key: 'JPG', value: 'image/jpeg' },
    { key: 'PDF', value: 'application/pdf' },
    { key: 'PNG', value: 'image/png' },
    { key: 'PPT', value: 'application/vnd.ms-powerpoint' },
    { key: 'TXT', value: 'text/plain' },
    { key: 'XLS', value: 'application/vnd.ms-excel' },
    { key: 'ZIP', value: 'application/zip' },
  ];
  return useCallback(() => {
    const menuItems = mimeTypes.map(item => {
      return {
        type: 'menu',
        text: item.key,
        onClick: () => {
          setFilter(prevFilter => {
            const newFilter = {
              ...prevFilter,
              mimeType: item,
            };
            return newFilter;
          });
        },
      };
    });
    return menuItems;
  }, [setFilter]);
};

export const useOnBuildPeopleContextMenu = () => {
  const [filter, setFilter] = useRecoilState(SharedWithMeFilterState);
  const [_userList, setUserList] = useState(getCurrentUserList());
  let userList = _userList;
  userList = _.uniqBy(userList, 'id');
  return useCallback(() => {
    const menuItems = userList.map(user => {
      return {
        type: 'menu',
        text: user.first_name,
        onClick: () => {
          setFilter(prevFilter => {
            const newFilter = {
              ...prevFilter,
              creator: user.id ?? '',
            };
            return newFilter;
          });
        },
      };
    });
    return menuItems;
  }, [setFilter]);
};

export const useOnBuildDateContextMenu = () => {
  const [filter, setFilter] = useRecoilState(SharedWithMeFilterState);
  return useCallback(() => {
    const menuItems = [
      {
        type: 'menu',
        text: Languages.t('components.item_context_menu.all'),
        onClick: () => {
          setFilter(prevFilter => {
            const newFilter = {
              ...prevFilter,
              date: {
                key: 'All',
                value: ''
              },
            };
            return newFilter;
          });
        },
      },
      {
        type: 'menu',
        text: Languages.t('components.item_context_menu.today'),
        onClick: () => {
          setFilter(prevFilter => {
            const newFilter = {
              ...prevFilter,
              date: {
                key: 'Today',
                value: 'today'
              }
            };
            return newFilter;
          });
        },
      },
      {
        type: 'menu',
        text: Languages.t('components.item_context_menu.last_week'),
        onClick: () => {
          setFilter(prevFilter => {
            const newFilter = {
              ...prevFilter,
              date: {
                key: 'Last week',
                value: 'last_week'
              }
            };
            return newFilter;
          });
        },
      },
      {
        type: 'menu',
        text: Languages.t('components.item_context_menu.last_month'),
        onClick: () => {
          setFilter(prevFilter => {
            const newFilter = {
              ...prevFilter,
              date: {
                key: 'Last month',
                value: 'last_month'
              }
            };
            return newFilter;
          });
        },
      },
    ];
    return menuItems;
  }, [setFilter]);
};
export const useOnBuildFileContextMenu = () => {
  const { download } = useDriveActions();
  const { open: preview } = useDrivePreview();
  return useCallback(
    (item: DriveItem) => {
      const menuItems = [
        {
          type: 'menu',
          text: Languages.t('components.item_context_menu.preview'),
          onClick: () => preview(item),
        },
        {
          type: 'menu',
          text: Languages.t('components.item_context_menu.download'),
          onClick: () => download(item.id),
        },
      ];
      return menuItems;
    },
    [download, preview],
  );
};

export const useOnBuildSortContextMenu = () => {
  const [sortItem, setSortItem] = useRecoilState(DriveItemSort);
  return useCallback(() => {
    const menuItems = [
      {
        type: 'menu',
        text: 'Date',
        icon: sortItem.by === 'date' ? 'check' : 'sort-check',
        onClick: () => {
          // keep the old value for sortItem and change the by value
          setSortItem(prevSortItem => {
            const newSortItem = {
              ...prevSortItem,
              by: 'date',
            };
            return newSortItem;
          });
        },
      },
      {
        type: 'menu',
        text: 'Name',
        icon: sortItem.by === 'name' ? 'check' : 'sort-check',
        onClick: () => {
          setSortItem(prevSortItem => {
            const newSortItem = {
              ...prevSortItem,
              by: 'name',
            };
            return newSortItem;
          });
        },
      },
      {
        type: 'menu',
        text: 'Size',
        icon: sortItem.by === 'size' ? 'check' : 'sort-check',
        onClick: () => {
          setSortItem(prevSortItem => {
            const newSortItem = {
              ...prevSortItem,
              by: 'size',
            };
            return newSortItem;
          });
        },
      },
      {type:"separator"},
      {
        type: 'menu',
        text: 'Ascending',
        icon: sortItem.order === 'asc' ? 'check' : 'sort-check',
        onClick: () => {
          setSortItem(prevSortItem => {
            const newSortItem = {
              ...prevSortItem,
              order: 'asc',
            };
            return newSortItem;
          });
        },
      },
      {
        type: 'menu',
        text: 'Descending',
        icon: sortItem.order === 'desc' ? 'check' : 'sort-check',
        onClick: () => {
          setSortItem(prevSortItem => {
            const newSortItem = {
              ...prevSortItem,
              order: 'desc',
            };
            return newSortItem;
          });
        },
      }
    ];
    return menuItems;
  }, [sortItem]);
};
