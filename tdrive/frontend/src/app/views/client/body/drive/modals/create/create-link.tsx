import { Button } from '@atoms/button/button';
import { Input } from '@atoms/input/input-text';
import { useDriveActions } from '@features/drive/hooks/use-drive-actions';
import { useState } from 'react';
import { useRecoilState } from 'recoil';
import { CreateModalAtom } from '.';
import FileUploadService from 'features/files/services/file-upload-service';
import Languages from 'features/global/services/languages-service';

export const CreateLink = () => {
  const [name, setName] = useState<string>('');
  const [link, setLink] = useState<string>('');
  const [loading] = useState<boolean>(false);
  const [state, setState] = useRecoilState(CreateModalAtom);
  const { create } = useDriveActions();

  const createLink = async () => {
    let finalLink = link.trim();
    if (!/^https?:\/\//i.test(finalLink)) finalLink = 'http://' + finalLink;
    const file = new File(['[InternetShortcut]\nURL=' + finalLink], name?.trim() + '.url', {
      type: 'text/uri-list',
    });

    FileUploadService.resetStates([file.name]);
    await FileUploadService.upload([{ root: file.name, file }], {
      context: {
        parentId: state.parent_id,
      },
      callback: (filePayload, context) => {
        const file = filePayload?.file;
        if (file)
          create(
            { name, parent_id: context.parentId, size: file.upload_data?.size },
            {
              provider: 'internal',
              application_id: '',
              file_metadata: {
                name: file.metadata?.name,
                size: file.upload_data?.size,
                mime: file.metadata?.mime,
                thumbnails: file?.thumbnails,
                source: 'internal',
                external_id: file.id,
              },
            },
          );
      },
    });
  };

  return (
    <>
      <Input
        disabled={loading}
        placeholder={Languages.t('components.create_link_modal.hint')}
        className="w-full mt-4"
        onChange={e => setName(e.target.value)}
        testClassId="create-link-name-input"
      />

      <Input
        disabled={loading}
        placeholder="https://example.com"
        className="w-full mt-4"
        onChange={e => setLink(e.target.value)}
        testClassId="create-link-input"
      />

      <Button
        disabled={!name || !link}
        loading={loading}
        className="mt-4 float-right"
        onClick={async () => {
          await createLink();
          setState({ ...state, open: false });
        }}
        testClassId="create-link-button"
      >
        {Languages.t('components.create_link_modal.button')}
      </Button>
    </>
  );
};
