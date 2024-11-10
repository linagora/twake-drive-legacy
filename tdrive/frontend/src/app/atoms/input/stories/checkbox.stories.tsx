/* eslint-disable @typescript-eslint/no-explicit-any */
import { ComponentStory } from '@storybook/react';
import { useState } from 'react';
import { Checkbox } from '../input-checkbox';
import { CheckboxSlider } from '../input-checkbox-slider';
import { Title } from 'app/atoms/text';

export default {
  title: '@atoms/checkbox',
};

const Template: ComponentStory<any> = (props: { label: string; disabled: boolean }) => {
  const [checked, setChecked] = useState(false);

  return (
    <div className="max-w-md">
      <Checkbox
        onChange={e => {
          setChecked(e);
        }}
        value={checked}
        disabled={props.disabled}
      />

      <br />

      <Checkbox
        onChange={e => {
          setChecked(e);
        }}
        value={checked}
        disabled={props.disabled}
        label={props.label}
      />

      <Title className='my-5'>CheckboxSlider</Title>

      <CheckboxSlider
        onClick={() => setChecked(!checked)}
        checked={checked}
        disabled={props.disabled}
        />
    </div>
  );
};

export const Default = Template.bind({});
Default.args = {
  label: 'Checkbox label',
  disabled: false,
};
