import { useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { CreateModalAtom, CreateModalAtomType } from '.';
import { Button } from '@atoms/button/button';
import { Input } from '@atoms/input/input-text';
import { Info } from '@atoms/text';
import { useDriveActions } from '@features/drive/hooks/use-drive-actions';
import Languages from "features/global/services/languages-service";

export const CreateFolder = () => {
  const [name, setName] = useState<string>('');
  const [loading, _] = useState<boolean>(false);
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
    await create({ name, parent_id: state.parent_id, is_directory: true }, {});
    setState({ ...state, open: false });
  }

  return (
    <>
      <Info>{ Languages.t('components.create_folder_modal.hint')}</Info>
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
        />
      </div>
      <Button
        disabled={!name}
        loading={loading}
        className="mt-4 float-right"
        onClick={createFolderHandler}
      >
        Create
      </Button>
    </>
  );
};
