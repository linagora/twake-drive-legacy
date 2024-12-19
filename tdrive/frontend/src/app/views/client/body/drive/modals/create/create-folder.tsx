import { useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { CreateModalAtom } from '.';
import { Button } from '@atoms/button/button';
import { Input } from '@atoms/input/input-text';
import { Base } from '@atoms/text';
import { useDriveActions } from '@features/drive/hooks/use-drive-actions';
import Languages from "features/global/services/languages-service";

export const CreateFolder = () => {
  const [name, setName] = useState<string>('');
  const [loading] = useState<boolean>(false);
  const [state, setState] = useRecoilState(CreateModalAtom);
  const { create } = useDriveActions();
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      const firstInput = inputRef.current && inputRef.current.querySelector("input") as HTMLInputElement;
      if (firstInput)
        firstInput.focus();
    }, 100);
  }, []);

  const createFolderHandler = async () => {
    await create({ name: (name || '').trim(), parent_id: state.parent_id, is_directory: true }, {});
    setState({ ...state, open: false });
  }

  return (
    <>
      <Base className="!font-medium">{ Languages.t('components.create_folder_modal.hint')}</Base>
      <div ref={inputRef}>
        <Input
          disabled={loading}
          placeholder={ Languages.t('components.create_folder_modal.placeholder')}
          className="w-full mt-4"
          onKeyDown={(e: any) => {
            if (e.keyCode === 13) {
              e.preventDefault();
              if (e.target.value)
                createFolderHandler();
            }
          }}
          onChange={(e: any) => setName(e.target.value)}
          testClassId="create-folder-input"
        />
      </div>
      <Button
        disabled={!(name || '').trim()}
        loading={loading}
        className="mt-4 float-right"
        onClick={createFolderHandler}
        testClassId="create-folder-button"
      >
        Create
      </Button>
    </>
  );
};
