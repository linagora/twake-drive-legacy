import { useEffect, useState } from 'react';

import MenusBodyLayer from '@components/menus/menus-body-layer';
import Api from '@features/global/framework/api-service';
import Languages from '@features/global/services/languages-service';
import { addApiUrlIfNeeded } from '@features/global/utils/URLUtils';
import RouterService from '@features/router/services/router-service';
import Drive from '@views/client/body/drive';
import { Button } from 'app/atoms/button/button';
import { Input } from 'app/atoms/input/input-text';
import { Base, Subtitle, Title } from 'app/atoms/text';
import UploadsViewer from 'app/components/file-uploads/uploads-viewer';
import { useDriveItem } from 'app/features/drive/hooks/use-drive-item';
import { ToasterService } from 'app/features/global/services/toaster-service';
import { useParams } from 'react-router-dom';
import shortUUID from 'short-uuid';
import Avatar from '../../../../atoms/avatar';
import AuthService from '@features/auth/auth-service';

import {
  DriveApiClient,
  setPublicLinkToken,
} from '../../../../features/drive/api-client/api-client';
import useRouterCompany from '../../../../features/router/hooks/use-router-company';
import { CreateModalWithUploadZones } from '../../side-bar/actions';
import { useCompanyApplications } from 'app/features/applications/hooks/use-company-applications';
import LocalStorage from 'app/features/global/framework/local-storage-service';

export default () => {
  const companyId = useRouterCompany();

  //Create a different local storage for shared view
  useEffect(() => {
    LocalStorage.setPrefix('tdrive-shared:');
    LocalStorage.clear();
  }, []);

  const [state, setState] = useState({ group: { logo: '', name: '' } });
  useEffect(() => {
    const routeState = RouterService.getStateFromRoute();
    Api.get('/internal/services/users/v1/companies/' + routeState.companyId, (res: any) => {
      if (res && res.resource) {
        setState({
          ...state,
          group: {
            name: res.resource.name,
            logo: addApiUrlIfNeeded(res.resource.logo),
          },
        });
      }
    });
  }, []);

  const group = state.group;

  const { token, documentId: _documentId } = useParams() as { token?: string; documentId?: string };
  const documentId = _documentId ? shortUUID().toUUID(_documentId || '') : '';

  if (!companyId) {
    return <></>;
  }

  return (
    <div className="flex flex-col h-full w-full dark:bg-zinc-900">
      <div className="flex flex-row items-center justify-center bg-blue-500 px-4 py-2">
        <div className="grow flex flex-row items-center">
          {group.logo && (
            <Avatar avatar={group.logo} className="inline-block mr-3" size="sm" type="square" />
          )}
          <span className="text-white font-semibold" style={{ lineHeight: '32px' }}>
            {group.name}
          </span>
        </div>
        <div className="shrink-0">
          <a href="https://twake.app" target="_BLANK" rel="noreferrer" className="!text-white">
            <span className="nomobile text-white">
              {Languages.t('scenes.app.mainview.create_account')}
            </span>
            Twake Workplace &nbsp; 👉
          </a>
        </div>
      </div>
      <div className="h-full main-view public p-4 pb-16">
        <AccessChecker folderId={documentId} token={token}>
          <Drive initialParentId={documentId} inPublicSharing />
        </AccessChecker>
      </div>
      <MenusBodyLayer />
      <UploadsViewer />
      <CreateModalWithUploadZones initialParentId={documentId} />
    </div>
  );
};

const AccessChecker = ({
  children,
  folderId,
  token,
}: {
  children: React.ReactNode;
  token?: string;
  folderId: string;
}) => {
  const { details, loading, refresh } = useDriveItem(folderId);
  const companyId = useRouterCompany();
  const [password, setPassword] = useState((token || '').split('+')[1] || '');
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);
  //Preload applications mainly for shared view
  const { refresh: refreshApplications } = useCompanyApplications();

  const setPublicToken = async (token: string, password?: string) => {
    try {
      setPublicLinkToken(token || null);

      const { access_token } = await DriveApiClient.getAnonymousToken(
        companyId,
        folderId,
        token,
        password,
      );

      if (!access_token) {
        throw new Error('Invalid password or token, or expired link.');
      }

      AuthService.onNewToken(access_token);

      setAccessGranted(true);
      await refresh(folderId);
      await refreshApplications();
    } catch (e) {
      console.error(e);
      ToasterService.error('Unable to access documents: ' + e);
      setAccessGranted(false);
    }
  };

  useEffect(() => void setPublicToken(token || ''), []);

  if ((!details?.item?.id && !loading) || accessGranted === false) {
    return (
      <div className="text-center">
        <div style={{ height: '20vh' }} />
        <div className="inline-block text-left max-w-sm margin-auto bg-zinc-50 dark:bg-zinc-800 rounded-md p-4">
          <Title>You don't have access to this document or folder.</Title>
          <br />
          <Base>The public link you are using may be invalid or expired.</Base>
          <br />
          <br />
          <Subtitle>I have a password</Subtitle>
          <br />
          <div className="flex items-center mt-2">
            <Input
              theme="outline"
              placeholder="Password"
              className="-mr-px rounded-r-none border-r-none"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <Button
              className="rounded-l-none"
              theme="primary"
              onClick={async () => {
                await setPublicToken(token || '', password);
                await refresh(folderId);
              }}
            >
              Submit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!accessGranted)
    return <></>;
  return <>{children}</>;
};
