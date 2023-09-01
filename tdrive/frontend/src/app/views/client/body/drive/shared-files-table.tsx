import { ChevronDownIcon, DotsHorizontalIcon } from '@heroicons/react/outline';
import { Button } from '@atoms/button/button';
import { Title } from '@atoms/text';
import Menu from '@components/menus/menu';
import { useRecoilState } from 'recoil';
import {
  useOnBuildFileTypeContextMenu,
  useOnBuildPeopleContextMenu,
  useOnBuildDateContextMenu,
  useOnBuildFileContextMenu,
} from './context-menu';
import { useSharedWithMeDriveItems } from '@features/drive/hooks/use-shared-with-me-drive-items';
import { SharedWithMeFilterState } from '@features/drive/state/shared-with-me-filter';
import MenusManager from '@components/menus/menus-manager.jsx';
import Languages from '@features/global/services/languages-service';

export const SharedFilesTable = () => {
  const { driveItems, loading } = useSharedWithMeDriveItems();
  const [filter] = useRecoilState(SharedWithMeFilterState);

  // FILTER HOOKS
  const buildFileTypeContextMenu = useOnBuildFileTypeContextMenu();
  const buildPeopleContextMen = useOnBuildPeopleContextMenu();
  const buildFileContextMenu = useOnBuildFileContextMenu();
  const buildDateContextMenu = useOnBuildDateContextMenu();

  const fileAddedDate = (timestamp: number) => {
    const [formattedDate] = new Date(timestamp).toLocaleString().split(', ');
    return formattedDate;
  };
  return (
    <div>
      <Title className="mb-4 block">{Languages.t('scenes.app.shared_with_me.shared_with_me')}</Title>
      {/* Filters */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="">
          <Button
            theme="secondary"
            className="flex items-center"
            onClick={evt => {
              MenusManager.openMenu(
                buildFileTypeContextMenu(),
                { x: evt.clientX, y: evt.clientY },
                'center',
              );
            }}
          >
            <span>{filter.mimeType ? filter.mimeType : Languages.t('scenes.app.shared_with_me.file_type')}</span>
            <ChevronDownIcon className="h-4 w-4 ml-2 -mr-1" />
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            theme="secondary"
            className="flex items-center"
            onClick={evt => {
              MenusManager.openMenu(
                buildPeopleContextMen(),
                { x: evt.clientX, y: evt.clientY },
                'center',
              );
            }}
          >
            <span>{Languages.t('scenes.app.shared_with_me.people')}</span>
            <ChevronDownIcon className="h-4 w-4 ml-2 -mr-1" />
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            theme="secondary"
            className="flex items-center"
            onClick={evt => {
              MenusManager.openMenu(
                buildDateContextMenu(),
                { x: evt.clientX, y: evt.clientY },
                'center',
              );
            }}
          >
            <span>{Languages.t('scenes.app.shared_with_me.last_modified')}</span>
            <ChevronDownIcon className="h-4 w-4 ml-2 -mr-1" />
          </Button>
        </div>
      </div>
      <Title className="mb-4 block">{Languages.t('scenes.app.drive.documents')}:</Title>
      <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-blue-500 dark:text-white">
            <tr>
              <th scope="col" className="px-6 py-3">
                <span className="flex">{Languages.t('scenes.app.shared_with_me.name')}</span>
              </th>
              <th scope="col" className="px-6 py-3">
                <span className="flex">{Languages.t('scenes.app.shared_with_me.shared_by')}</span>
              </th>
              <th scope="col" className="px-6 py-3">
                <span className="flex">Shared Date{Languages.t('scenes.app.shared_with_me.shared_date')}</span>
              </th>
              <th scope="col" className="px-6 py-3">
                <span className="sr-only">{Languages.t('scenes.app.shared_with_me.edit')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              driveItems.map((file: any, index: any) => (
                <tr
                  key={index}
                  className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <th
                    scope="row"
                    className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white"
                  >
                    {file.name}
                  </th>
                  <td className="px-6 py-4">{file.creator?.id}</td>
                  <td className="px-6 py-4">{fileAddedDate(file.added)}</td>
                  <td className="px-6 py-4 text-right">
                    <Menu menu={buildFileContextMenu(file)}>
                      <Button
                        theme={'secondary'}
                        size="sm"
                        className={'!rounded-full '}
                        icon={DotsHorizontalIcon}
                      />
                    </Menu>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
