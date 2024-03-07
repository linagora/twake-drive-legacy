import { DocumentIcon, FolderIcon } from '@heroicons/react/solid';
import { Button } from '@atoms/button/button';
import { Checkbox } from '@atoms/input/input-checkbox';
import { Modal, ModalContent } from '@atoms/modal';
import { useDriveItem } from '@features/drive/hooks/use-drive-item';
import { DriveItem } from '@features/drive/types';
import { useEffect, useState } from 'react';
import { atom, useRecoilState } from 'recoil';
import { PathRender } from '../../header-path';
import Languages from '@features/global/services/languages-service';


export type SelectorModalType = {
  open: boolean;
  parent_id: string;
  mode: 'move' | 'select-file' | 'select-files';
  title: string;
  onSelected: (ids: string[]) => Promise<void>;
};

export const SelectorModalAtom = atom<SelectorModalType>({
  key: 'SelectorModalAtom',
  default: {
    open: false,
    parent_id: '',
    mode: 'move',
    title: '',
    onSelected: async () => {},
  },
});

export const SelectorModal = () => {
  const [state, setState] = useRecoilState(SelectorModalAtom);

  return (
    <Modal open={state.open} onClose={() => setState({ ...state, open: false })}>
      <SelectorModalContent key={state.parent_id} showfiles={false}/>
    </Modal>
  );
};

const SelectorModalContent = (key:any,showfiles:boolean) => {
  const [state, setState] = useRecoilState(SelectorModalAtom);
  const [selected, setSelected] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [parentId, setParentId] = useState(state.parent_id);

  const { children, path, item: parent, refresh } = useDriveItem(parentId);

  useEffect(() => {
    if (state.mode === 'select-file' && parent) setSelected([]);
    if (state.mode === 'move' && parent) setSelected([parent]);
    refresh(parentId);
  }, [parentId, parent?.id]);

  const folders = (children?.filter(i => i.is_directory) || []).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const files = (children?.filter(i => !i.is_directory) || []).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <ModalContent title={state.title}>
      <PathRender
        path={path || []}
        inTrash={false}
        onClick={(id: string) => {
          setParentId(id);
        }}
      />

      <div
        className="border border-gray-300 rounded-md mb-4 mt-2 overflow-auto"
        style={{ height: '30vh' }}
      >
        {folders.map(folder => (
          <div
            key={folder.id}
            className={
              'flex flex-row items-center border-t -mt-px px-4 py-2 cursor-pointer ' +
              'hover:bg-zinc-500 hover:bg-opacity-10 '
            }
            onClick={() => {
              setParentId(folder.id);
            }}
          >
            <div className="grow flex flex-row items-center dark:text-white">
              <FolderIcon className="h-5 w-5 shrink-0 text-blue-500 mr-2" />
              {folder.name}
            </div>
          </div>
        ))}
        
        {key.showfiles && ( 
        <>
        {files.map(file => (
          <div
          key={file.id}
          className={
            'flex flex-row items-center border-t -mt-px px-4 py-2 cursor-pointer ' +
            'hover:bg-zinc-500 hover:bg-opacity-10 '
          }
          onClick={() => {
            if (state.mode === 'select-files') {
              if (!selected.some(i => i.id === file.id)) {
                setSelected([...selected, file]);
              } else {
                setSelected(selected.filter(i => i.id !== file.id));
              }
            } else if (state.mode === 'select-file') {
              setSelected([file]);
            }
          }}
          >
          <div className="grow flex flex-row items-center dark:text-white">
            <DocumentIcon className="h-5 w-5 shrink-0 text-gray-400 mr-2" />
            {file.name}
          </div>
          {(state.mode === 'select-file' || state.mode === 'select-files') && (
            <div className="shrink-0" onClick={e => e.stopPropagation()}>
              <Checkbox value={selected.some(i => i.id === file.id)} />
            </div>
          )}
          </div>
          ))}
        </>
        )}
      </div>

      <Button
        disabled={selected.length === 0}
        loading={loading}
        theme="primary"
        className="float-right"
        onClick={async () => {
          setLoading(true);
          await state.onSelected(selected.map(i => i.id));
          setState({ ...state, open: false });
          setLoading(false);
        }}
      >
        {selected.length === 0 ? (
          <>{Languages.t('components.SelectorModalContent_no_items')}</>
        ) : state.mode === 'move' ? (
          <>{Languages.t('components.SelectorModalContent_move_to')} '{selected[0]?.name}'</>
        ) : selected.length > 1 ? (
          <> {selected.length} {Languages.t('components.SelectorModalContent_select')} {Languages.t('components.SelectorModalContent_files')}</>
        ) : (
          <>{Languages.t('components.SelectorModalContent_select')} '{selected[0]?.name}'</>
        )}
      </Button>
    </ModalContent>
  );
};
