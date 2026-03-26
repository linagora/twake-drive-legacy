import { useEffect, useRef, useState } from 'react';
import { uniqueId } from 'lodash';

import Languages from 'features/global/services/languages-service';
import Logger from '@features/global/framework/logger-service';

import BaseBlock from '@molecules/grouped-rows/base';
import { Base } from '@atoms/text';
import { Input } from 'app/atoms/input/input-text';
import { CheckboxSlider } from 'app/atoms/input/input-checkbox-slider';
import { Button } from 'app/atoms/button/button';
import { ShieldCheckIcon, PencilAltIcon } from '@heroicons/react/outline';
import { ConfirmModal } from 'app/atoms/modal/confirm';

import Styles from './styles';

const getLogger = () => Logger.getLogger('password-editor-row');

export const PasswordEditorRow = (props: {
  disabled?: boolean;
  password?: string;
  isLinkExpired: boolean;
  onChangePassword: (password: string) => Promise<void>;
}) => {
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [currentEditedPassword, setCurrentEditedPassword] = useState("");
  const [isWaitingForPasswordSave, setIsWaitingForPasswordSave] = useState(false);
  const [isConfirmingPasswordRemoval, setIsConfirmingPasswordRemoval] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const [chkPasswordId] = useState(uniqueId("chk"));

  const disabled = props.disabled || isWaitingForPasswordSave;

  useEffect(() => {
    if (!isEditingPassword || !inputRef.current) return;
    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      timeout = null;
      inputRef.current?.focus();
    }, 10);
    return () => {
      if (timeout) clearTimeout(timeout);
      timeout = null;
    }
  }, [ isEditingPassword ])

  function savePassword(password: string) {
    setIsWaitingForPasswordSave(true);
    props.
      onChangePassword(password).
      then(
        () => {
          setIsWaitingForPasswordSave(false);
          setIsEditingPassword(false);
        },
        (e: unknown) => {
          getLogger().error("Error while saving password:", e);
          setIsWaitingForPasswordSave(false);
        },
      );
  }

  function confirmSavePassword(password: string) {
    if (password === (props.password ?? "")) {
      setIsEditingPassword(false);
      return;
    }
    // If link is also expired, removing the password won't expose it,
    // no need to stress the user with a confirmation
    if (!password.length && !props.isLinkExpired)
      setIsConfirmingPasswordRemoval(true);
    else
      savePassword(password);
  }

return <>
    <BaseBlock
      className={"m-4" + (disabled ? Styles.Disabled.Yes : "") + ' testid:password-editor-row'}
      disabled={disabled}
      avatar={<ShieldCheckIcon className={Styles.SmallIconClasses} />}
      title={
        <Base>
          <label htmlFor={chkPasswordId}>{Languages.t('components.public-link-security_password')}</label>
          {!!props.password?.length && !isEditingPassword &&
            <a
              className={(disabled ? Styles.Disabled.Yes : "!text-zinc-800") + ' testid:button-edit'}
              onClick={() => {
                if (!disabled) {
                  setCurrentEditedPassword(props.password!);
                  setIsEditingPassword(true);
                }
              }}
              >
                <PencilAltIcon className={Styles.SmallIconClasses + "ml-1 inline align-bottom"} />
            </a>
          }
        </Base>
      }
      subtitle={''}
      suffix={isEditingPassword
        ? <>
            <Input
              type="password"
              inputRef={inputRef}
              disabled={disabled}
              className="max-w-xs mr-4 mt-1"
              size='sm'
              value={currentEditedPassword}
              onChange={e => setCurrentEditedPassword(e.target.value)}
              onKeyUp={e => {
                if (e.key == 'Escape')
                  setIsEditingPassword(false);
                else if (e.key == 'Enter')
                  confirmSavePassword(currentEditedPassword);
              }}
              testClassId="input-edit-password"
            />
            <Button
              disabled={disabled}
              theme="default"
              size="sm"
              className="max-w-xs mr-2 mt-1"
              onClick={() => confirmSavePassword(currentEditedPassword)}
              testClassId="button-confirm"
            >
              {Languages.t('components.public-link-security_field_confirm_edit')}
            </Button>
          </>
        : <CheckboxSlider
            id={chkPasswordId}
            checked={!!props.password?.length}
            disabled={disabled}
            onChange={({target: { checked }}) => {
              if (checked) {
                setIsEditingPassword(checked);
                if (checked && !currentEditedPassword.length)
                  setCurrentEditedPassword(!props.password?.length ? Math.random().toString(36).slice(-8) : props.password);
              } else
                confirmSavePassword("");
            }}
            testClassId="checkbox"
          />
      }
      />

    <ConfirmModal
      open={isConfirmingPasswordRemoval}
      title={Languages.t("components.public-link-security_password_removal_title")}
      text={Languages.t("components.public-link-security_password_removal_body")}
      buttonOkTheme='primary'
      buttonOkLabel='components.public-link-security_password_removal_confirm'
      onClose={() => setIsConfirmingPasswordRemoval(false)}
      onOk={() => savePassword("")}
    />
  </>;
}