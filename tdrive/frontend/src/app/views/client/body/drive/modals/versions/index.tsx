import { Button } from '@atoms/button/button';
import { Modal, ModalContent } from '@atoms/modal';
import { Base, BaseSmall } from '@atoms/text';
import UploadZone from '@components/uploads/upload-zone';
import { useDriveActions } from '@features/drive/hooks/use-drive-actions';
import { useDriveItem } from '@features/drive/hooks/use-drive-item';
import { formatBytes } from '@features/drive/utils';
import { formatDate } from '@features/global/utils/format-date';
import _ from 'lodash';
import { useEffect, useRef } from 'react';
import { atom, useRecoilState } from 'recoil';
import Languages from '@features/global/services/languages-service';


export type VersionsModalType = {
  open: boolean;
  id: string;
};

export const VersionsModalAtom = atom<VersionsModalType>({
  key: 'VersionsModalAtom',
  default: {
    open: false,
    id: '',
  },
});

export const VersionsModal = () => {
  const [state, setState] = useRecoilState(VersionsModalAtom);

  return (
    <Modal open={state.open} onClose={() => setState({ ...state, open: false })}>
      {!!state.id && <VersionModalContent id={state.id} />}
    </Modal>
  );
};

const VersionModalContent = ({ id }: { id: string }) => {
  const { item, versions, access, refresh, loading, uploadVersion } = useDriveItem(id);
  const { download } = useDriveActions();

  const uploadZone = 'drive_versions_' + id;
  const uploadZoneRef = useRef<UploadZone | null>(null);

  useEffect(() => {
    refresh(id);
  }, []);

  if (!item?.last_version_cache) return <></>;

  return (
    <ModalContent title={Languages.t('compenents.VersionModalContent_version') + " " + item?.name}>
      <UploadZone
        overClassName={'!m-4'}
        disableClick
        parent={''}
        multiple={false}
        allowPaste={false}
        ref={uploadZoneRef}
        driveCollectionKey={uploadZone}
        disabled={loading || access === 'read'}
        onAddFiles={async (files: File[]) => {
          const file = files[0];
          await uploadVersion(file);
          await refresh(id);
        }}
      >
        {access !== 'read' && (
          <div className={'flex flex-row items-center bg-zinc-100 dark:bg-zinc-900 rounded-md mb-4 p-4'}>
            <div className="flex flex-row">
              <div className="grow flex items-center">
                <Base>
                {Languages.t('compenents.VersionModalContent_version_dec')}
                </Base>
              </div>
              <div className="shrink-0 ml-4 flex items-center">
                <Button
                  theme="primary"
                  onClick={() => uploadZoneRef.current?.open()}
                  loading={loading}
                >
                  {Languages.t('compenents.VersionModalContent_create')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {_.orderBy(
          [...(versions?.length ? versions : [item.last_version_cache])],
          f => -f.date_added,
        ).map((version, index) => (
          <div
            key={index}
            className={
              'flex flex-row items-center border -mt-px px-4 py-3 cursor-pointer hover:bg-zinc-500 hover:bg-opacity-10 ' +
              (index === 0 ? 'rounded-t-md ' : '') +
              (index === (versions || []).length - 1 ? 'rounded-b-md ' : '')
            }
          >
            <div className="grow text-ellipsis whitespace-nowrap overflow-hidden">
              <Base>{version.file_metadata.name}</Base>
            </div>
            <div className="shrink-0 ml-4">
              <BaseSmall>{formatDate(version.date_added || 0)}</BaseSmall>
            </div>
            <div className="shrink-0 ml-4">
              <BaseSmall>{formatBytes(version.file_metadata.size || 0)}</BaseSmall>
            </div>
            <div className="shrink-0 ml-4">
              <Button theme="outline" onClick={() => download(id, version.id)}>
              {Languages.t('compenents.VersionModalContent_donwload')}
              </Button>
            </div>
          </div>
        ))}
      </UploadZone>
    </ModalContent>
  );
};
