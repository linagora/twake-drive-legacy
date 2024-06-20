import fileUploadApiClient from '@features/files/api/file-upload-api-client';
import fileUploadService from '@features/files/services/file-upload-service';
import { useGlobalEffect } from '@features/global/hooks/use-global-effect';
import { LoadingState } from '@features/global/state/atoms/Loading';
import { useRecoilState } from 'recoil';
import { DriveApiClient } from '../api-client/api-client';
import { DriveViewerState } from '../state/viewer';
import { DriveItem } from '../types';
import { useHistory } from 'react-router-dom';
import RouterServices from '@features/router/services/router-service';
import useRouterCompany from '@features/router/hooks/use-router-company';
import { DriveCurrentFolderAtom } from 'app/views/client/body/drive/browser';
import { useCurrentUser } from 'app/features/users/hooks/use-current-user';

export const useDrivePreviewModal = () => {
  const history = useHistory();
  const company = useRouterCompany();
  const [status, setStatus] = useRecoilState(DriveViewerState);
  const { user } = useCurrentUser();
  const [ parentId, setParentId ] = useRecoilState(
    DriveCurrentFolderAtom({ initialFolderId: 'user_'+user?.id }),
  );

  const open: (item: DriveItem) => void = (item: DriveItem) => {
    if (item.last_version_cache?.file_metadata?.source === 'internal') {
      setStatus({ item, loading: true });
    } else if (item.is_directory){
      setParentId(item.id);
    }
  };

  const openWithId: (id: string) => void = (id: string) => {
    DriveApiClient.get(company, id).then((item) => {
      open(item?.item);
    });
  }

  const close = () => {
    setStatus({ item: null, loading: true });
  }

  return { open, close, isOpen: !!status.item, openWithId };
};

export const useDrivePreview = () => {
  const [status, setStatus] = useRecoilState(DriveViewerState);
  const modal = useDrivePreviewModal();

  useGlobalEffect(
    'useDrivePreview',
    async () => {
      if (modal.isOpen && status.item) {
        setStatus({
          ...status,
          loading: true,
        });

        const details = await DriveApiClient.get(status.item.company_id, status.item.id);

        setStatus({
          ...status,
          details,
          loading: false,
        });
      }
    },
    [status.item?.id],
  );

  return {
    ...modal,
    status,
    loading: status.loading,
  };
};

export const useDrivePreviewLoading = () => {
  const [loading, setLoading] = useRecoilState(LoadingState('useDrivePreviewLoading'));

  return { loading, setLoading };
};

export const useDrivePreviewDisplayData = () => {
  const { status } = useDrivePreview();

  if (!status) {
    return {};
  }

  const name =
    status.details?.item.last_version_cache.file_metadata.name || status.details?.item.name || '';
  const extension = name.split('.').pop();
  const type = fileUploadApiClient.mimeToType(
    status.details?.item.last_version_cache.file_metadata.mime || '',
    extension,
  );
  const id = status.details?.item.last_version_cache.file_metadata.external_id || '';
  const download = fileUploadService.getDownloadRoute({
    companyId: status.item?.company_id || '',
    fileId: status.details?.item.last_version_cache.file_metadata.external_id || '',
  });

  return { download, id, name, type, extension, size: status.details?.item.size };
};

