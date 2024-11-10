import { Checkbox } from '@atoms/input/input-checkbox';
import { DriveItem } from '@features/drive/types';
import { ReactNode } from 'react';

export type DriveItemProps = {
  item: DriveItem;
  className: string;
  onCheck: (status: boolean) => void;
  checked: boolean;
  onClick?: () => void;
  onBuildContextMenu: () => Promise<any[]>;
};

export type DriveItemOverlayProps = {
  item: DriveItem|null;
  className: string;
};

export const CheckableIcon = ({
  show,
  fallback,
  checked,
  onCheck,
  className,
}: {
  fallback: ReactNode;
  show: boolean;
  checked: boolean;
  onCheck: (v: boolean) => void;
  className: string;
}) => {
  return (
    <div className={className}>
      {show && (
        <div className="w-6 text-center">
          <Checkbox value={checked} onChange={onCheck} />
        </div>
      )}
      {!show && <div className="w-6 flex flew-row justify-center">{fallback}</div>}
    </div>
  );
};
