import A from '@atoms/link';
import { Base, Info, Subtitle } from '@atoms/text';
import { useDriveItem, getPublicLink } from '@features/drive/hooks/use-drive-item';
import { ToasterService } from '@features/global/services/toaster-service';
import { copyToClipboard } from '@features/global/utils/CopyClipboard';
import { Checkbox } from 'app/atoms/input/input-checkbox';
import { Input } from 'app/atoms/input/input-text';
import { useEffect, useRef, useState } from 'react';
import { AccessLevel } from './common';
import moment from 'moment';
import 'moment/min/locales';
import Languages from 'features/global/services/languages-service';
import { debounce } from 'lodash';

export const PublicLinkManager = ({ id, disabled }: { id: string; disabled?: boolean }) => {
  const { item, loading, update } = useDriveItem(id);
  const publicLink = getPublicLink(item);

  return (
    <>
      <Base className="block mt-2 mb-1">
        {Languages.t('components.public-link-acess.public_link_acess')}
      </Base>
      <div className="p-4 rounded-md border">
        <div className="flex flex-row overflow-hidden w-full">
          <div className="grow">
            {item?.access_info?.public?.level !== 'none' && (
              <Info>{Languages.t('components.public-link-acess.info_acess_true')}</Info>
            )}
            {item?.access_info?.public?.level === 'none' && (
              <Info>{Languages.t('components.public-link-acess.info_acess_false')}</Info>
            )}
            {item?.access_info?.public?.level !== 'none' && (
              <>
                <br />
                <A
                  className="inline-block"
                  onClick={() => {
                    copyToClipboard(publicLink);
                    ToasterService.success(Languages.t('components.public-link-copied-info'));
                  }}
                >
                  {Languages.t('components.public-link-copy')}
                </A>
              </>
            )}
          </div>
          <div className="shrink-0">
            <AccessLevel
              hiddenLevels={['manage']}
              disabled={loading || disabled}
              level={item?.access_info?.public?.level || null}
              onChange={level => {
                update({
                  access_info: {
                    entities: item?.access_info.entities || [],
                    public: { ...(item?.access_info?.public || { token: '' }), level },
                  },
                });
              }}
            />
          </div>
        </div>
        {item?.access_info?.public?.level !== 'none' && (
          <PublicLinkOptions
            disabled={loading || disabled}
            password={item?.access_info?.public?.password}
            expiration={item?.access_info?.public?.expiration}
            onChangePassword={(password: string) => {
              update({
                access_info: {
                  entities: item?.access_info.entities || [],
                  public: {
                    ...item!.access_info!.public!,
                    password: password || '',
                  },
                },
              }, true);
            }}
            onChangeExpiration={(expiration: number) => {
              update({
                access_info: {
                  entities: item?.access_info.entities || [],
                  public: {
                    ...item!.access_info!.public!,
                    expiration: expiration || 0,
                  },
                },
              });
            }}
          />
        )}
      </div>{' '}
    </>
  );
};

const PublicLinkOptions = (props: {
  disabled?: boolean;
  password?: string;
  expiration?: number;
  onChangePassword: Function;
  onChangeExpiration: Function;
}) => {
  const [usePassword, setUsePassword] = useState(!!props.password);
  const [password, setPassword] = useState(props.password);
  const [useExpiration, setUseExpiration] = useState((props.expiration || 0) > 0);
  const [expiration, setExpiration] = useState(props.expiration);
  const handlePasswordBlur = () => {
    props.onChangePassword(password);
  };

  const debouncedOnChangePassword = debounce(passwordValue => {
    props.onChangePassword(passwordValue);
  }, 500); // 500ms delay

  useEffect(() => {
    // Ensure the effect runs only if usePassword or password changes
    debouncedOnChangePassword(usePassword ? password : '');

    // Cleanup function to cancel the debounced call if the component is unmounted or the dependencies change
    return () => {
      debouncedOnChangePassword.cancel();
    };
  }, [usePassword, password]);

  useEffect(() => {
    props.onChangeExpiration(useExpiration ? expiration : 0);
  }, [useExpiration, expiration]);

  function expirationDate(exp: moment.MomentInput) {
    moment.locale(Languages.getLanguage());
    return moment(exp).fromNow(true).toLocaleString();
  }

  return (
    <>
      <Subtitle className="block mt-4 mb-1">
        {Languages.t('components.public-link-security')}
      </Subtitle>
      <div className="flex items-center justify-center w-full h-10">
        <Checkbox
          disabled={props.disabled}
          onChange={s => {
            setUsePassword(s);
            if (!password && s) setPassword(Math.random().toString(36).slice(-8));
          }}
          value={!!usePassword}
          label={Languages.t('components.public-link-security_password')}
        />
        <div className="grow mr-2" />
        {!!usePassword && (
          <Input
            disabled={props.disabled}
            className="max-w-xs"
            value={password}
            onChange={e => setPassword(e.target.value)}
            // saves and copies password
            onClick={() => {
              if (password) copyToClipboard(password);
              ToasterService.success(
                Languages.t('components.public-link-security_password_copied'),
              );
            }}
          />
        )}
      </div>
      <div className="flex items-center justify-center w-full h-10">
        <Checkbox
          disabled={props.disabled}
          onChange={s => {
            setUseExpiration(s);
            if (!expiration && s) setExpiration(Date.now() + 1000 * 60 * 60 * 24 * 7);
          }}
          value={!!useExpiration}
          label={Languages.t('components.public-link-security_expired')}
        />
        {useExpiration && (expiration || 0) < Date.now() && (
          <Info className="ml-2 text-red-500">
            ({Languages.t('components.public-link-security_expired')})
          </Info>
        )}
        {useExpiration && (expiration || 0) > Date.now() && (
          <Info className="ml-2">({expirationDate(expiration)})</Info>
        )}{' '}
        <div className="grow mr-2" />
        {!!useExpiration && (
          <Input
            disabled={props.disabled}
            type="date"
            className="max-w-xs"
            value={new Date(expiration || 0).toISOString().split('T')[0]}
            onChange={e => {
              e.target.value && setExpiration(new Date(e.target.value).getTime());
            }}
          />
        )}
      </div>
    </>
  );
};
