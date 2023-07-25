import { ChevronDownIcon, DotsHorizontalIcon } from '@heroicons/react/outline';
import { Button } from '@atoms/button/button';
import { Base, BaseSmall, Subtitle, Title } from '@atoms/text';
import Menu from '@components/menus/menu';
import { getFilesTree } from '@components/uploads/file-tree-utils';
import UploadZone from '@components/uploads/upload-zone';
import { setTdriveTabToken } from '@features/drive/api-client/api-client';
import { useDriveItem } from '@features/drive/hooks/use-drive-item';
import { DriveRealtimeObject } from '@features/drive/hooks/use-drive-realtime';
import { useDriveUpload } from '@features/drive/hooks/use-drive-upload';
import { DriveItemSelectedList } from '@features/drive/state/store';
import { formatBytes } from '@features/drive/utils';
import useRouterCompany from '@features/router/hooks/use-router-company';
import _ from 'lodash';
import { memo, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { atomFamily, useRecoilState, useSetRecoilState } from 'recoil';
import { DrivePreview } from '../../viewer/drive-preview';
import {
  useOnBuildContextMenu,
  useOnBuildFileTypeContextMenu,
  useOnBuildPeopleContextMenu,
  useOnBuildDateContextMenu,
} from './context-menu';
import { DocumentRow } from './documents/document-row';
import { FolderRow } from './documents/folder-row';
import HeaderPath from './header-path';
import { ConfirmDeleteModal } from './modals/confirm-delete';
import { ConfirmTrashModal } from './modals/confirm-trash';
import { CreateModalAtom } from './modals/create';
import { PropertiesModal } from './modals/properties';
import { AccessModal } from './modals/update-access';
import { VersionsModal } from './modals/versions';
import { SharedFilesTable } from './shared-files-table';
import useRouteState from 'app/features/router/hooks/use-route-state';
import { SharedWithMeFilterState } from '@features/drive/state/shared-with-me-filter';
import MenusManager from '@components/menus/menus-manager.jsx';
import Languages from 'features/global/services/languages-service';
import {DndContext, useSensors, useSensor, PointerSensor} from '@dnd-kit/core';
import { Droppable } from 'app/features/dragndrop/hook/droppable';
import { Draggable } from 'app/features/dragndrop/hook/draggable';
import { useDriveActions } from '@features/drive/hooks/use-drive-actions';
import { ConfirmModalAtom } from './modals/confirm-move/index';
import { useCurrentUser } from 'app/features/users/hooks/use-current-user';


export const DriveCurrentFolderAtom = atomFamily<
  string,
  { context?: string; initialFolderId: string }
>({
  key: 'DriveCurrentFolderAtom',
  default: options => options.initialFolderId || 'root',
});


export default memo(
  ({
    context,
    initialParentId,
    tdriveTabContextToken,
    inPublicSharing,
  }: {
    context?: string;
    initialParentId?: string;
    tdriveTabContextToken?: string;
    inPublicSharing?: boolean;
  }) => {
    const { user } = useCurrentUser();
    const companyId = useRouterCompany();
    setTdriveTabToken(tdriveTabContextToken || null);
    const [filter, setFilter] = useRecoilState(SharedWithMeFilterState);

    const [parentId, _setParentId] = useRecoilState(
      DriveCurrentFolderAtom({ context: context, initialFolderId: initialParentId || 'user_'+user?.id }),
    );

    const [loadingParentChange, setLoadingParentChange] = useState(false);
    const {
      sharedWithMe,
      details,
      access,
      item,
      inTrash,
      refresh,
      children,
      loading: loadingParent,
      path,
    } = useDriveItem(parentId);
    const { uploadTree } = useDriveUpload();

    const loading = loadingParent || loadingParentChange;

    const uploadZone = 'drive_' + companyId;
    const uploadZoneRef = useRef<UploadZone | null>(null);

    const setCreationModalState = useSetRecoilState(CreateModalAtom);

    const [checked, setChecked] = useRecoilState(DriveItemSelectedList);

    const setParentId = useCallback(
      async (id: string) => {
        setLoadingParentChange(true);
        try {
          await refresh(id);
          _setParentId(id);
        } catch (e) {
          console.error(e);
        }
        setLoadingParentChange(false);
      },
      [_setParentId],
    );

    

    //In case we are kicked out of the current folder, we need to reset the parent id
    useEffect(() => {
      if (!loading && !path?.length && !inPublicSharing && !sharedWithMe) setParentId('user_'+user?.id);
    }, [path, loading, setParentId]);

    useEffect(() => {
      setChecked({});
      refresh(parentId);
      if (!inPublicSharing) refresh('trash');
    }, [parentId, refresh, filter]);

    const openItemModal = useCallback(() => {
      if (item?.id) setCreationModalState({ open: true, parent_id: item.id });
    }, [item?.id, setCreationModalState]);

    const selectedCount = Object.values(checked).filter(v => v).length;
    const folders = children
      .filter(i => i.is_directory)
      .sort((a, b) => a.name.localeCompare(b.name));
    const documents = (
      item?.is_directory === false
        ? //We use this hack for public shared single file
          item
          ? [item]
          : []
        : children
    )
      .filter(i => !i.is_directory)
      .sort((a, b) => a.name.localeCompare(b.name));

    const onBuildContextMenu = useOnBuildContextMenu(children, initialParentId);
    const { viewId } = useRouteState();

    const handleDragOver = (event: { preventDefault: () => void; }) => {
      event.preventDefault();
    }
    const handleDrop = async (event: {dataTransfer: any; preventDefault: () => void;}) => {
      event.preventDefault();
      const dataTransfer = event.dataTransfer;
              if (dataTransfer) {
                const tree = await getFilesTree(dataTransfer);
                setCreationModalState({ parent_id: '', open: false });
                uploadTree(tree, {
                  companyId,
                  parentId,
              });
              }
    }

    const buildFileTypeContextMenu = useOnBuildFileTypeContextMenu();
    const buildPeopleContextMen = useOnBuildPeopleContextMenu();
    const buildDateContextMenu = useOnBuildDateContextMenu();
    const setConfirmModalState = useSetRecoilState(ConfirmModalAtom);
    const [activeId, setActiveId] = useState();
    const {update} = useDriveActions();
    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 8,
        },
      })
    );
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);


    function handleDragStart(event:any) {
      const { active } = event;
      const { id } = active;
  
      setActiveId(id);
    }

    function handleDragEnd(event:any) {
      if (event.over){
        setConfirmModalState({
          open: true,
          parent_id: inTrash ? 'root' : event.over.data.current.child.props.item.id,
          mode: 'move',
          title:
            Languages.t('components.item_context_menu.move.modal_header') +
            ` '${event.active.data.current.child.props.item.name}'`,
          onSelected: async ids => {
            await update(
              {
                parent_id: ids[0],
              },
              event.active.data.current.child.props.item.id,
              event.active.data.current.child.props.item.parent_id,
            );
          },
        })
      }
      
    }

    function draggableMarkup(index: number, child: any) {
      return (
          isMobile ? (
            <DocumentRow
              key={index}
              className={
                (index === 0 ? 'rounded-t-md ' : '') +
                (index === documents.length - 1 ? 'rounded-b-md ' : '')
              }
              item={child}
              checked={checked[child.id] || false}
              onCheck={v =>
                setChecked(_.pickBy({ ...checked, [child.id]: v }, _.identity))
              }
              onBuildContextMenu={() => onBuildContextMenu(details, child)}
            />
          ) : (
            <Draggable index={index}>
              <DocumentRow
                key={index}
                className={
                  (index === 0 ? 'rounded-t-md ' : '') +
                  (index === documents.length - 1 ? 'rounded-b-md ' : '')
                }
                item={child}
                checked={checked[child.id] || false}
                onCheck={v =>
                  setChecked(_.pickBy({ ...checked, [child.id]: v }, _.identity))
                }
                onBuildContextMenu={() => onBuildContextMenu(details, child)}
              />
            </Draggable>
          )
      );
    }
    

    return (
      <>
        {viewId == 'shared-with-me' ? (
          <>
            <Suspense fallback={<></>}>
              <DrivePreview items={documents} />
            </Suspense>
            <SharedFilesTable />
          </>
        ) : (
          <UploadZone
            overClassName={''}
            className="h-full overflow-hidden"
            disableClick
            parent={''}
            multiple={true}
            allowPaste={true}
            ref={uploadZoneRef}
            driveCollectionKey={uploadZone}
            onAddFiles={async (_, event) => {
              const tree = await getFilesTree(event);
              setCreationModalState({ parent_id: '', open: false });
              uploadTree(tree, {
                companyId,
                parentId,
              });
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}

          >
            <DriveRealtimeObject id={parentId} key={parentId} />
            <VersionsModal />
            <AccessModal />
            <PropertiesModal />
            <ConfirmDeleteModal />
            <ConfirmTrashModal />
            <Suspense fallback={<></>}>
              <DrivePreview items={documents} />
            </Suspense>
            <div
              className={
                'flex flex-col grow h-full overflow-hidden ' +
                (loading && (!children?.length || loadingParentChange) ? 'opacity-50 ' : '')
              }
            >
              <div className="flex flex-row shrink-0 items-center mb-4">
                {sharedWithMe ? (
                  <div>
                    <Title className="mb-4 block">
                      {Languages.t('scenes.app.shared_with_me.shared_with_me')}
                    </Title>
                    {/* Filters */}
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="">
                        <Button
                          theme="secondary"
                          className="flex items-center"
                          onClick={evt => {
                            MenusManager.openMenu(
                              buildFileTypeContextMenu(),
                              { x: evt.clientX, y: evt.clientY },
                              'center',
                            );
                          }}
                        >
                          <span>
                            {filter.mimeType.key && filter.mimeType.key != 'All'
                              ? filter.mimeType.key
                              : Languages.t('scenes.app.shared_with_me.file_type')}
                          </span>
                          <ChevronDownIcon className="h-4 w-4 ml-2 -mr-1" />
                        </Button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          theme="secondary"
                          className="flex items-center"
                          onClick={evt => {
                            MenusManager.openMenu(
                              buildPeopleContextMen(),
                              { x: evt.clientX, y: evt.clientY },
                              'center',
                            );
                          }}
                        >
                          <span>{Languages.t('scenes.app.shared_with_me.people')}</span>
                          <ChevronDownIcon className="h-4 w-4 ml-2 -mr-1" />
                        </Button>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          theme="secondary"
                          className="flex items-center"
                          onClick={evt => {
                            MenusManager.openMenu(
                              buildDateContextMenu(),
                              { x: evt.clientX, y: evt.clientY },
                              'center',
                            );
                          }}
                        >
                          <span>
                            {filter.date.key && filter.date.key != 'All'
                              ? filter.date.key
                              : Languages.t('scenes.app.shared_with_me.last_modified')}
                          </span>
                          <ChevronDownIcon className="h-4 w-4 ml-2 -mr-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <HeaderPath path={path || []} inTrash={inTrash} setParentId={setParentId} />
                )}
                <div className="grow" />

                {access !== 'read' && (
                  <BaseSmall>
                    {formatBytes(item?.size || 0)} {Languages.t('scenes.app.drive.used')}
                  </BaseSmall>
                )}
                <Menu menu={() => onBuildContextMenu(details)}>
                  {' '}
                  <Button theme="secondary" className="ml-4 flex flex-row items-center">
                    <span>
                      {selectedCount > 1
                        ? `${selectedCount} items`
                        : Languages.t('scenes.app.drive.context_menu')}{' '}
                    </span>

                    <ChevronDownIcon className="h-4 w-4 ml-2 -mr-1" />
                  </Button>
                </Menu>
              </div>


              <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
                <div className="grow overflow-auto">
                
                  {folders.length > 0 && (
                    <>
                      <Title className="mb-2 block">{Languages.t('scenes.app.drive.folders')}</Title>

                      {folders.map((child, index) => (
                        <Droppable id={index} key={index}>
                        <FolderRow
                            key={index}
                            className={
                              (index === 0 ? 'rounded-t-md ' : '') +
                              (index === folders.length - 1 ? 'rounded-b-md ' : '')
                            }
                            item={child}
                            onClick={() => {
                              return setParentId(child.id);
                            }}
                            checked={checked[child.id] || false}
                            onCheck={v =>
                              setChecked(_.pickBy({ ...checked, [child.id]: v }, _.identity))
                            }
                            onBuildContextMenu={() => onBuildContextMenu(details, child)}
                          />
                        </Droppable>
                      ))}
                      <div className="my-6" />
                    </>
                  )}

                  <Title className="mb-2 block">{Languages.t('scenes.app.drive.documents')}</Title>

                  {documents.length === 0 && !loading && (
                    <div className="mt-4 text-center border-2 border-dashed rounded-md p-8">
                      <Subtitle className="block mb-2">
                        {Languages.t('scenes.app.drive.nothing')}
                      </Subtitle>
                      {!inTrash && access != 'read' && (
                        <>
                          <Base>{Languages.t('scenes.app.drive.drag_and_drop')}</Base>
                          <br />
                          <Button onClick={() => openItemModal()} theme="primary" className="mt-4">
                            {Languages.t('scenes.app.drive.add_doc')}
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {documents.map((child, index) => (
                    draggableMarkup(index, child)
                  ))}

                </div>
              </DndContext>
              </div>    
          </UploadZone>
        )}

      </>
    );
    
  },
);
