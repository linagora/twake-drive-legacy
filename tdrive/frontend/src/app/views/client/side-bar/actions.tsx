import { PlusIcon, TruckIcon, UploadIcon } from '@heroicons/react/outline';
import { useCallback, useRef } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { AnimatedHeight } from '../../../atoms/animated-height';
import { getFilesTree } from '../../../components/uploads/file-tree-utils';
import UploadZone from '../../../components/uploads/upload-zone';
import { useDriveItem } from '../../../features/drive/hooks/use-drive-item';
import { useDriveUpload } from '../../../features/drive/hooks/use-drive-upload';
import useRouterCompany from '../../../features/router/hooks/use-router-company';
import { DriveCurrentFolderAtom } from '../body/drive/browser';
import { ConfirmDeleteModalAtom } from '../body/drive/modals/confirm-delete';
import { CreateModal, CreateModalAtom } from '../body/drive/modals/create';
import { Button } from '@atoms/button/button';
import Languages from "features/global/services/languages-service";
import { useCurrentUser } from 'app/features/users/hooks/use-current-user';

export const CreateModalWithUploadZones = ({ initialParentId }: { initialParentId?: string }) => {
  const companyId = useRouterCompany();
  const uploadZoneRef = useRef<UploadZone | null>(null);
  const uploadFolderZoneRef = useRef<UploadZone | null>(null);
  const setCreationModalState = useSetRecoilState(CreateModalAtom);
  const { uploadTree, uploadFromUrl } = useDriveUpload();
  const { user } = useCurrentUser();
  const [parentId, _] = useRecoilState(
    DriveCurrentFolderAtom({ initialFolderId: initialParentId || 'user_'+user?.id }),
  );

  console.log("Upload Zone:: " + parentId);

  return (
    <>
      <UploadZone
        overClassName={'!hidden'}
        className="hidden"
        disableClick
        parent={''}
        multiple={true}
        ref={uploadZoneRef}
        driveCollectionKey={'side-menu'}
        onAddFiles={async (_, event) => {
          const tree = await getFilesTree(event);
          setCreationModalState({ parent_id: '', open: false });
          uploadTree(tree, {
            companyId,
            parentId,
          });
        }}
      />
      <UploadZone
        overClassName={'!hidden'}
        className="hidden"
        disableClick
        parent={''}
        multiple={true}
        ref={uploadFolderZoneRef}
        directory={true}
        driveCollectionKey={'side-menu'}
        onAddFiles={async (_, event) => {
          const tree = await getFilesTree(event);
          setCreationModalState({ parent_id: '', open: false });
          uploadTree(tree, {
            companyId,
            parentId,
          });
        }}
      />
      <CreateModal
        selectFolderFromDevice={() => uploadFolderZoneRef.current?.open()}
        selectFromDevice={() => uploadZoneRef.current?.open()}
        addFromUrl={(url, name) => {
          setCreationModalState({ parent_id: '', open: false });
          uploadFromUrl(url, name, {
            companyId,
            parentId,
          });
        }}
      />
    </>
  );
};

export default () => {
  const { user } = useCurrentUser();
  const [parentId, _] = useRecoilState(DriveCurrentFolderAtom({ initialFolderId: 'user_'+user?.id  }));
  const { access, item, inTrash } = useDriveItem(parentId);
  const { children: trashChildren } = useDriveItem('trash');
  const uploadZoneRef = useRef<UploadZone | null>(null);
  const { uploadTree } = useDriveUpload();
  const companyId = useRouterCompany();

  const setConfirmDeleteModalState = useSetRecoilState(ConfirmDeleteModalAtom);
  const setCreationModalState = useSetRecoilState(CreateModalAtom);

  const openItemModal = useCallback(() => {
    if (item?.id) setCreationModalState({ open: true, parent_id: item.id });
  }, [item?.id, setCreationModalState]);

  return (
    <div className="-m-4 overflow-hidden">
      <AnimatedHeight>
        <div className="p-4">
          <CreateModalWithUploadZones initialParentId={parentId} />

          {inTrash && access === 'manage' && (
            <>
              <Button
                onClick={() =>
                  setConfirmDeleteModalState({
                    open: true,
                    items: trashChildren,
                  })
                }
                size="lg"
                theme="danger"
                className="w-full mb-2 justify-center"
              >
                <TruckIcon className="w-5 h-5 mr-2" /> { Languages.t('components.side_menu.buttons.empty_trash') }
              </Button>
            </>
          )}
          {!(inTrash || access === 'read') && (
            <>
              <UploadZone
                overClassName={'!hidden'}
                className="hidden"
                disableClick
                parent={''}
                multiple={true}
                ref={uploadZoneRef}
                driveCollectionKey={'side-menu'}
                onAddFiles={async (_, event) => {
                  const tree = await getFilesTree(event);
                  setCreationModalState({ parent_id: '', open: false });
                  uploadTree(tree, {
                    companyId,
                    parentId,
                  });
                }}
              />

              <Button
                onClick={() => {
                  uploadZoneRef.current?.open();
                }}
                size="lg"
                theme="primary"
                className="w-full mb-2 justify-center"
                style={{ boxShadow: '0 0 10px 0 rgba(0, 122, 255, 0.5)' }}
              >
                <UploadIcon className="w-5 h-5 mr-2" /> {Languages.t('components.side_menu.buttons.upload')}
              </Button>
              <Button
                onClick={() => openItemModal()}
                size="lg"
                theme="secondary"
                className="w-full mb-2 justify-center"
              >
                <PlusIcon className="w-5 h-5 mr-2" /> {Languages.t('components.side_menu.buttons.create')}
              </Button>
            </>
          )}
        </div>
      </AnimatedHeight>
    </div>
  );
};
