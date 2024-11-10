import { DesktopComputerIcon } from '@heroicons/react/solid';
import { Base } from '@atoms/text';

export const DriveItem = ({ className, onClick }: { className?: string; onClick: () => void }) => {
  return (
    <div
      className={
        'rounded-md bg-zinc-500 bg-opacity-10 w-64 m-1 inline-flex flex-row items-center px-4 py-3 cursor-pointer hover:bg-zinc-500 hover:bg-opacity-25 ' +
        (className || '')
      }
      onClick={() => {
        onClick();
      }}
    >
      <DesktopComputerIcon className="h-5 w-5 shrink-0 text-blue-500 mr-2" />
      <div className="grow text-ellipsis whitespace-nowrap overflow-hidden">
        <Base className="!font-semibold">Device 1o</Base>
      </div>
    </div>
  );
};
