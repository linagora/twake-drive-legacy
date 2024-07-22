import moment from 'moment';
import 'moment/min/locales';

import { useEffect, useRef, useState } from 'react';
import { uniqueId } from 'lodash';

import Logger from '@features/global/framework/logger-service';
import Languages from 'features/global/services/languages-service';

import BaseBlock from '@molecules/grouped-rows/base';
import { Base, Info } from '@atoms/text';
import { Input } from 'app/atoms/input/input-text';
import { CheckboxSlider } from 'app/atoms/input/input-checkbox-slider';
import { Button } from 'app/atoms/button/button';
import { CalendarIcon, PencilAltIcon } from '@heroicons/react/outline';
import { ConfirmModal } from 'app/atoms/modal/confirm';

import Styles from './styles';

const getLogger = () => Logger.getLogger('expiry-editor-row');

export const ExpiryEditorRow = (props: {
  disabled?: boolean;
  value: number;
  isLinkPasswordProtected: boolean;
  onChange: (value: number) => Promise<void>;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentEditedValue, setCurrentEditedValue] = useState(0);
  const [isWaitingForSave, setIsWaitingForSave] = useState(false);
  const [isConfirmingExpiryRemoval, setIsConfirmingExpiryRemoval] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const [chkExpiryId] = useState(uniqueId("chk"));

  const disabled = props.disabled || isWaitingForSave;

  useEffect(() => {
    if (!isEditing || !inputRef.current) return;
    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      timeout = null;
      inputRef.current?.focus();
    }, 10);
    return () => {
      if (timeout) clearTimeout(timeout);
      timeout = null;
    }
  }, [ isEditing ])

  function saveValue(value: number) {
    setIsWaitingForSave(true);
    props.
      onChange(value).
      then(
        () => {
          setIsWaitingForSave(false);
          setIsEditing(false);
        },
        (e: unknown) => {
          getLogger().error("Error while saving expiry date:", e);
          setIsWaitingForSave(false);
        },
      );
  }

  function confirmSaveExpiry(expiry: number) {
    if (expiry === props.value) {
      setIsEditing(false);
      return;
    }
    if (expiry == 0 && (props.value > 0 && props.value < Date.now()))
      setIsConfirmingExpiryRemoval(true);
    else
      saveValue(expiry);
  }

  function expirationDate(exp: moment.MomentInput) {
    moment.locale(Languages.getLanguage());
    return moment(exp).fromNow(true).toLocaleString();
  }

  return <>
    <BaseBlock
      className={"m-4" + (disabled ? Styles.Disabled.Yes : "")}
      disabled={disabled}
      avatar={<CalendarIcon className={Styles.SmallIconClasses} />}
      title={
        <Base>
          <label htmlFor={chkExpiryId}>{Languages.t('components.public-link-security_expiration_title')}</label>
          {!!props.value && !isEditing &&
            <>
              <a
                className={disabled ? Styles.Disabled.Yes : ""}
                onClick={() => {
                  if (!disabled) {
                    setCurrentEditedValue(props.value);
                    setIsEditing(true);
                  }
                  return false;
                }}
                >
                  <PencilAltIcon className={Styles.SmallIconClasses + "ml-1 inline align-bottom"} />
              </a>

              {(currentEditedValue || props.value) <= Date.now()
                ? <Info className="ml-2 !text-red-500">
                    ({Languages.t('components.public-link-security_expired')})
                  </Info>
                : <Info className="ml-2">({expirationDate(currentEditedValue || props.value)})</Info>
              }{' '}
            </>
          }
        </Base>
      }
      subtitle={''}
      suffix={isEditing
        ? <>
            <Input
              inputRef={inputRef}
              disabled={disabled}
              className="max-w-xs mr-4 mt-1 py-0"
              type="date"
              size='sm'
              min={moment().add(1, 'days').toISOString().split('T')[0]}
              value={new Date(currentEditedValue).toISOString().split('T')[0]}
              onChange={e => e.target.value && setCurrentEditedValue(new Date(e.target.value).getTime())}
              onKeyUp={e => {
                if (e.key == 'Escape')
                  setIsEditing(false);
                else if (e.key == 'Enter')
                  confirmSaveExpiry(currentEditedValue);
              }}
            />
            <Button
              disabled={disabled}
              theme="default"
              size="sm"
              className="max-w-xs mr-2 mt-1"
              onClick={() => confirmSaveExpiry(currentEditedValue)}
              >
              {Languages.t('components.public-link-security_field_confirm_edit')}
            </Button>
          </>
        : <CheckboxSlider
            id={chkExpiryId}
            checked={!!props.value}
            disabled={disabled}
            onChange={({target: { checked }}) => {
              if (checked) {
                setIsEditing(checked);
                if (checked && !currentEditedValue)
                  setCurrentEditedValue(props.value || moment().add(7, 'days').unix() * 1000);
              } else
                confirmSaveExpiry(0);
            }}
            />
      }
      />
    <ConfirmModal
      open={isConfirmingExpiryRemoval}
      onClose={() => setIsConfirmingExpiryRemoval(false)}
      onOk={() => saveValue(0)}
      title={Languages.t("components.public-link-security_expiration_removal_title")}
      text={props.isLinkPasswordProtected
        ? Languages.t("components.public-link-security_expiration_removal_but_password")
        : Languages.t("components.public-link-security_expiration_removal_no_password")
      }
      buttonOkTheme='primary'
      buttonOkLabel="components.public-link-security_expiration_removal_confirm"
      />
  </>;
}