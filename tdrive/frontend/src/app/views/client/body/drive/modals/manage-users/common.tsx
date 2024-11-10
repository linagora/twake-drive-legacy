import Select from '@atoms/input/input-select';
import { DriveFileAccessLevel } from '@features/drive/types';
import Languages from 'features/global/services/languages-service';

export const AccessLevel = ({
  level,
  onChange,
  hiddenLevels,
  className,
}: {
  disabled?: boolean;
  level: DriveFileAccessLevel | null;
  onChange: (level: DriveFileAccessLevel & 'remove') => void;
  className?: string;
  hiddenLevels?: string[];
}) => {
  return (
    <Select
      className={
        className +
        ' w-auto ' +
        (level === 'none' ? '!text-rose-500 !bg-rose-100 dark-bg-rose-800' : '')
      }
      value={level || 'read'}
      onChange={e => onChange(e.target.value as DriveFileAccessLevel & 'remove')}
    >
      {!hiddenLevels?.includes('manage') && <option value={'manage'}>{Languages.t('common.access-level_full_access')}</option>}
      {!hiddenLevels?.includes('read') && <option value={'read'}>{Languages.t('common.access-level_read')}</option>}
    </Select>
  );
};
