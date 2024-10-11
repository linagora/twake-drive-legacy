import { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { AccessLevelDropdown } from './access-level-dropdown';
import { Input } from '@atoms/input/input-text';

const meta: Meta<typeof AccessLevelDropdown> = {
  component: AccessLevelDropdown,
  argTypes: {
    level: {
      options: "none read write manage".split(' '),
    },
    size: {
      options: "(empty string),sm,md,lg".split(','),
      mapping: { '(empty string)': '' },
    },
  }
};
export default meta;

export const Default = {
  args: {
    level: "manage",
    disabled: false,
    className: '',
    hiddenLevels: [],
    size: 'md',
    labelOverrides: {},
    onChange: action('onChange'),
  },
  render: (props: React.ComponentProps<typeof AccessLevelDropdown>) => <>
    <AccessLevelDropdown {...props} />
    <div className='italic dark:text-white m-3'>Level "none" has a different appearance:</div>
    <AccessLevelDropdown {...props} level={'none'} />
  </>,
};

export const NoRemoveAndRenameNone = {
  args: {
    ...Default.args,
    hiddenLevels: ['remove'],
    labelOverrides: { none: "I can't do that, Dave." },
  },
};

export const EndOfInputBox = {
  args: {
    ...Default.args,
  },
  render: (props: React.ComponentProps<typeof AccessLevelDropdown>) => <>
    <div className="p-4 flex flex-row items-center justify-center w-1/3">
      <div className="grow">
        <Input
          theme='plain'
          className="rounded-r-none w-full"
          placeholder="Search users or something like that"
          />
      </div>
      <div className="shrink-0">
        <AccessLevelDropdown
          {...props}
          className="rounded-l-none !p-0 leading-tight text-end !pr-8 border-none bg-zinc-100 dark:bg-zinc-900"
          size="md"
          />
      </div>
    </div>
  </>,
};

export const BorderLess = {
  args: {
    ...Default.args,
    className: '!p-0 leading-tight text-end !pr-8 border-none bg-transparent dark:bg-transparent',
  },
};
