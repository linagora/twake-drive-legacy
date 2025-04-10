/* eslint-disable @typescript-eslint/no-empty-function */
import { Modal } from 'antd';

import Languages from '@features/global/services/languages-service';
import { TdriveService } from '../framework/registry-decorator-service';

const { confirm, info } = Modal;

type Options = {
  title?: string;
  text?: string;
};
@TdriveService('Alert')
class AlertServiceService {
  alert(onClose: () => void, options?: Options) {
    info({
      title: options?.title || options?.text || '',
      content: options?.text || '',
      onCancel: onClose,
    });
  }

  confirm(onConfirm: () => void, onClose: (() => void) | false = () => {}, options?: Options) {
    confirm({
      title: options?.title || Languages.t('components.alert.confirm'),
      content: options?.text || Languages.t('components.alert.confirm_click'),
      onOk: onConfirm,
      onCancel: onClose || undefined,
      cancelButtonProps: onClose ? {} : { style: { display: 'none' } },
      okText: Languages.t('general.ok'),
      cancelText: Languages.t('general.cancel'),
    });
  }
}
const AlertManager = new AlertServiceService();

export default AlertManager;
