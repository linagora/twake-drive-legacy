/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo } from 'react';
import { Modal } from 'antd';
import './modal-component.scss';
import ModalManager from '@components/modal/modal-manager';

let component: any = null;
export default () => {
  const open = ModalManager.useWatcher(() => ModalManager.isOpen());

  const eventClose = useMemo(
    () => (evt: any) => {
      if (evt.keyCode === 27 && ModalManager.canClose()) {
        close();
      }
    },
    [],
  );

  const close = () => {
    if (ModalManager.canClose()) {
      ModalManager.close();
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    document.addEventListener('keydown', eventClose);
    return () => {
      document.removeEventListener('keydown', eventClose);
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  component = ModalManager.getComponent() || component;

  return (
    <Modal
      onCancel={close}
      centered
      closable={false}
      title={null}
      open={open}
      footer={null}
      destroyOnClose={true}
      width={ModalManager.getPosition()?.size?.width || '700px'}
    >
      {component}
    </Modal>
  );
};
