import Avatar from '@atoms/avatar';
import A from '@atoms/link';
import { Modal, ModalContent } from '@atoms/modal';
import { Base } from '@atoms/text';
import { useCompanyApplications } from '@features/applications/hooks/use-company-applications';
import { Application } from '@features/applications/types/application';
import { Transition } from '@headlessui/react';
import {
  ChevronLeftIcon,
  DocumentDownloadIcon,
  FolderAddIcon,
  FolderDownloadIcon,
  LinkIcon,
} from '@heroicons/react/outline';
import { ReactNode } from 'react';
import { atom, useRecoilState } from 'recoil';
import { slideXTransition, slideXTransitionReverted } from 'src/utils/transitions';
import { CreateFolder } from './create-folder';
import { CreateLink } from './create-link';
import Languages from "features/global/services/languages-service";
import { FileTypeDocumentIcon, FileTypeSlidesIcon, FileTypeSpreadsheetIcon } from 'app/atoms/icons-colored';

export type CreateModalAtomType = {
  open: boolean;
  parent_id: string;
  type?: string;
};

export const CreateModalAtom = atom<CreateModalAtomType>({
  key: 'CreateModalAtom',
  default: {
    open: false,
    parent_id: 'root',
  },
});

export const CreateModal = ({
  selectFromDevice,
  selectFolderFromDevice,
  addFromUrl,
}: {
  selectFromDevice: () => void;
  selectFolderFromDevice: () => void;
  addFromUrl: (url: string, name: string) => void;
}) => {
  const [state, setState] = useRecoilState(CreateModalAtom);
  const { applications } = useCompanyApplications();

  return (
    <Modal
      open={state.open}
      onClose={() => setState({ ...state, open: false })}
      className="!max-w-sm"
    >
      <ModalContent
        title={
          <div className="flex flex-row items-center justify-start">
            {!!state.type && (
              <A onClick={() => setState({ ...state, type: '' })}>
                <ChevronLeftIcon className="w-6 h-6" />
              </A>
            )}
            <span className="ml-2">
              {Languages.t('components.create_modal.create_folder_or_doc')}
            </span>
          </div>
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplate: '1fr / 1fr',
          }}
        >
          <Transition
            style={{
              gridColumn: '1 / 1',
              gridRow: '1 / 1',
            }}
            show={!state.type}
            as="div"
            {...(!state.type ? slideXTransitionReverted : slideXTransition)}
          >
            <div className="-m-2">
              <CreateModalOption
                icon={<FolderAddIcon className="w-5 h-5" />}
                text={Languages.t('components.create_modal.create_folder')}
                onClick={() => setState({ ...state, type: 'folder' })}
              />
              <CreateModalOption
                icon={<LinkIcon className="w-5 h-5" />}
                text={Languages.t('components.create_modal.create_link')}
                onClick={() => setState({ ...state, type: 'link' })}
              />

              {(applications || [])
                .filter(app => app.display?.tdrive?.files?.editor?.empty_files?.length)
                .reduce(
                  (a, app) => [
                    ...a,
                    ...(app.display?.tdrive?.files?.editor?.empty_files || [])
                      .filter(ef => ef?.filename)
                      .map(ef => ({
                        app,
                        emptyFile: ef,
                      })),
                  ],
                  [] as {
                    app: Application;
                    emptyFile: {
                      url: string; // "https://[...]/empty.docx";
                      filename: string; // "Untitled.docx";
                      name: string; // "Word Document"
                    };
                  }[],
                )
                .map((app, i) => {
                  return (
                    <CreateModalOption
                      key={i}
                      icon={app.emptyFile.filename === "Untitled.docx" ?  (
                        <FileTypeDocumentIcon className={'h-5 w-5 shrink-0 text-gray-400'} />
                      ) : app.emptyFile.filename === "Untitled.xlsx" ? (
                        <FileTypeSpreadsheetIcon className={'h-5 w-5 shrink-0 text-gray-400'} />
                      ) : app.emptyFile.filename === "Untitled.pptx" ? (
                        <FileTypeSlidesIcon className={'h-5 w-5 shrink-0 text-gray-400'} />
                      ) : (
                        <Avatar
                          type="square"
                          size="sm"
                          className="w-5 h-5"
                          avatar={app.app.identity?.icon}
                        />
                      )}
                      text={Languages.t(`${app.emptyFile.name}`)}
                      onClick={() =>
                        addFromUrl(app.emptyFile.url, app.emptyFile.filename || app.emptyFile.name)
                      }
                    />
                  );
                })}
            </div>
          </Transition>

          <Transition
            style={{
              gridColumn: '1 / 1',
              gridRow: '1 / 1',
            }}
            show={state.type === 'folder'}
            as="div"
            {...(!state.type ? slideXTransitionReverted : slideXTransition)}
          >
            <CreateFolder />
          </Transition>

          <Transition
            style={{
              gridColumn: '1 / 1',
              gridRow: '1 / 1',
            }}
            show={state.type === 'link'}
            as="div"
            {...(!state.type ? slideXTransitionReverted : slideXTransition)}
          >
            <CreateLink />
          </Transition>
        </div>
      </ModalContent>
    </Modal>
  );
};

const CreateModalOption = (props: { icon: ReactNode; text: string; onClick: () => void }) => {
  return (
    <div
      onClick={props.onClick}
      className="flex flex-row p-4 dark:bg-zinc-800 dark:text-white bg-zinc-100 hover:bg-opacity-75 cursor-pointer rounded-md m-2"
    >
      <div className="flex items-center justify-center">{props.icon}</div>
      <div className="grow flex items-center ml-2">
        <Base>{props.text}</Base>
      </div>
    </div>
  );
};
