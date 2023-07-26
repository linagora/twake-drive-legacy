/* eslint-disable @typescript-eslint/no-explicit-any */
import PerfectScrollbar from 'react-perfect-scrollbar';
import SearchResulsDriveItems from './tabs/drive';

export const SearchResultsIndex = () => {
  return (
    <>
      <PerfectScrollbar
        className="-mb-4 py-3 overflow-hidden -mx-2 px-2"
        style={{ maxHeight: 'calc(80vh - 100px)', minHeight: 'calc(80vh - 100px)' }}
        options={{ suppressScrollX: true, suppressScrollY: false }}
        component="div"
      >
        <SearchResulsDriveItems/>
      </PerfectScrollbar>
    </>
  );
};
