import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';

import { RecoilRoot } from 'recoil';
import { ComponentStory } from '@storybook/react';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/outline';

import { ConfirmModal, ConfirmModalProps } from './confirm';
const icons = {
  check: CheckCircleIcon,
  exclamation: ExclamationCircleIcon,
  none: null,
}
export default {
  title: '@atoms/modal/confirm',
  component: ConfirmModal,
  argTypes: {
    theme: {
      options: "success danger warning gray".split(' '),
    },
    buttonTheme: {
      options: "primary secondary danger default outline dark white green",
    },
    open: { table: { disable: true } },
    icon: {
      options: [...Object.keys(icons)],
      mapping: icons,
    }
  },
  args: {
    title: "Very brief description",
    text: "Long description no one will probably really read",
    buttonOkLabel: 'general.continue',
    skipCancelOnClose: false,
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Template: ComponentStory<any> = (props: ConfirmModalProps) => {
  const [open, setOpen] = useState(true);

  return (
    <RecoilRoot>
      <button className='dark:text-white' onClick={() => setOpen(true)}>Open</button>
      <ConfirmModal
        {...props}
        open={open}
        onClose={(...a) => {
          setOpen(false);
          action("onClose")(...a);
        }}
        onOk={action("onOk")}
        onCancel={action("onCancel")}
        />
    </RecoilRoot>
  );
}

export const Default = Template.bind({});
Default.args = {};