import React from 'react';

export const FolderRowSkeleton = () => {
  return (
    <div className="flex flex-row items-center border border-zinc-200 dark:border-zinc-800 -mt-px px-4 py-3 cursor-pointer animate-pulse">
      <div className="mr-2 -ml-1">
        <div className="bg-gray-300 h-5 w-5 rounded-full"></div>
      </div>
      <div className="grow text-ellipsis whitespace-nowrap overflow-hidden">
        <div className="bg-gray-300 h-6 w-3/4 rounded"></div>
      </div>
      <div className="shrink-0 ml-4">
        <div className="bg-gray-300 h-5 w-5 rounded-full"></div>
      </div>
      <div className="shrink-0 ml-4 text-right minWidth80">
        <div className="bg-gray-300 h-4 w-20 rounded"></div>
      </div>
      <div className="shrink-0 ml-4">
        <div className="bg-gray-300 h-8 w-8 rounded-full"></div>
      </div>
    </div>
  );
};
