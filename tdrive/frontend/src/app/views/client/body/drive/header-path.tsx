import { Title } from '@atoms/text';
import { DriveItem } from '@features/drive/types';
import { ChevronDownIcon } from '@heroicons/react/solid';
import { useEffect, useState } from 'react';
import { PublicIcon } from './components/public-icon';
import MenusManager from '@components/menus/menus-manager.jsx';
import { useCurrentUser } from 'app/features/users/hooks/use-current-user';
import { useDriveItem } from '@features/drive/hooks/use-drive-item';
import Languages from 'features/global/services/languages-service';
import { useHistory } from 'react-router-dom';
import useRouterCompany from '@features/router/hooks/use-router-company';
import RouterServices from '@features/router/services/router-service';

export default ({
  path: livePath,
  inTrash,
  setParentId,
  inPublicSharing,
}: {
  path: DriveItem[];
  inTrash?: boolean;
  setParentId: (id: string) => void;
  inPublicSharing?: boolean;
}) => {
  const [savedPath, setSavedPath] = useState<DriveItem[]>([]);
  const history = useHistory();
  const company = useRouterCompany();
  useEffect(() => {
    if (livePath) setSavedPath(livePath);
  }, [livePath]);
  const path = livePath || savedPath;

  return (
    <PathRender
      inTrash={inTrash || false}
      path={path}
      onClick={(viewId, dirId) => {
        history.push(
          RouterServices.generateRouteFromState({
            companyId: company,
            viewId,
            dirId,
          }),
        );
        console.log("viewId changed now setting the parentId")
        if(inPublicSharing) return setParentId(dirId ? dirId : viewId);
      }}
    />
  );
};

function cutFileName(name: any) {
  if (typeof name !== 'undefined') {
    if (name.length >= 30) {
      return name.substring(0, 30) + ' ...';
    } else {
      return name;
    }
  } else {
    return name;
  }
}

export const PathRender = ({
  path,
  onClick,
}: {
  path: DriveItem[];
  inTrash: boolean;
  onClick: (viewId: string, dirId: string) => void;
}) => {
  const parentIndex = path.findIndex(item => item.is_in_trash);
  const pathToRender = parentIndex > -1 ? path.slice(parentIndex - 1) : path;
  const pathLength = (pathToRender || []).reduce((acc, curr) => acc + curr.name.length, 0);

  return (
    <nav className="overflow-hidden whitespace-nowrap mr-2 pl-px inline-flex">
      {pathLength < 70 ? (
        (pathToRender || [])?.map((a, i) => (
          <PathItem
            key={a.id}
            item={a}
            first={i === 0}
            last={i + 1 === pathToRender?.length}
            onClick={onClick}
          />
        ))
      ) : (
        <>
          <PathItem
            key={pathToRender[pathToRender.length - 3]?.id}
            item={{
              ...pathToRender[pathToRender?.length - 3],
              name: '...',
            }}
            first={true}
            last={false}
            onClick={onClick}
          />
          <PathItem
            key={pathToRender[pathToRender.length - 2]?.id}
            item={pathToRender[pathToRender?.length - 2]}
            first={false}
            last={false}
            onClick={onClick}
          />
          <PathItem
            key={pathToRender[pathToRender.length - 1]?.id}
            item={pathToRender[pathToRender?.length - 1]}
            first={false}
            last={true}
            onClick={onClick}
          />
        </>
      )}
    </nav>
  );
};

const PathItem = ({
  item,
  first,
  last,
  onClick,
}: {
  item: Partial<DriveItem>;
  last?: boolean;
  first?: boolean;
  onClick: (viewId: string, dirId: string) => void;
}) => {
  const { user } = useCurrentUser();
  const { viewId } = RouterServices.getStateFromRoute();
  const { access: trashAccess } = useDriveItem('trash');
  const isInSharedWithMe = viewId === 'shared_with_me';
  return (
    <div className="flex items-center">
      <a
        href="#"
        className="text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
        onClick={evt => {
          evt.preventDefault();

          const trashMenuItems = [
            {
              type: 'menu',
              text: Languages.t('components.header_path.my_trash'),
              onClick: () => onClick('trash_' + user?.id, ''),
            },
            {
              type: 'menu',
              text: Languages.t('components.header_path.shared_trash'),
              onClick: () => onClick('trash', ''),
              hide: trashAccess === 'read',
            },
          ];
          if (first && isInSharedWithMe) {
            onClick(viewId || '', '');
            return;
          }

          if (first && user?.id) {
            if (viewId?.includes('trash')) {
              MenusManager.openMenu(trashMenuItems, { x: evt.clientX, y: evt.clientY }, 'center');
            } else {
              if (viewId === 'root') {
                onClick('root', '')
              } else if (viewId === 'user_' + user?.id) {
                onClick('user_' + user?.id, '')
              }
            }
          } else {
            onClick(viewId || '', item?.id || '');
          }
        }}
      >
        <Title>
          {(() => {
            const isTrash = viewId?.includes('trash_') || viewId === 'trash';
            const fileName = cutFileName(item?.name) || '';

            if (first) {
              if (isTrash) {
                return viewId?.includes('trash_')
                  ? Languages.t('components.header_path.my_trash')
                  : Languages.t('components.header_path.shared_trash');
              } else {
                return isInSharedWithMe
                  ? Languages.t('components.header_path.shared_with_me')
                  : fileName;
              }
            } else {
              return isTrash ? fileName : fileName;
            }
          })()}
        </Title>
      </a>
      {item?.access_info?.public?.level && item?.access_info?.public?.level !== 'none' && (
        <PublicIcon className="h-5 w-5 ml-2" />
      )}
      {first && !!user?.id && viewId?.includes('trash') && (
        <span className="ml-2 -mr-1 text-gray-700">
          <ChevronDownIcon className="w-4 h-4" />
        </span>
      )}
      {!last && (
        <svg
          aria-hidden="true"
          className="w-6 h-6 text-gray-400 mx-1"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          ></path>
        </svg>
      )}
    </div>
  );
};
