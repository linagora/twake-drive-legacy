import { EditConfigInitResult, IEditorService, ModeParametersType } from '@/interfaces/editor.interface';
import { UserType } from '@/interfaces/user.interface';
import { ONLY_OFFICE_SERVER } from '@config';
import * as Utils from '@/utils';

class EditorService implements IEditorService {
  public init = async (
    company_id: string,
    file_name: string,
    file_version_id: string,
    user: UserType,
    preview: boolean,
    file_id: string,
  ): Promise<EditConfigInitResult> => {
    const { color, mode: fileMode } = this.getFileMode(file_name);
    let [, extension] = Utils.splitFilename(file_name);

    extension = extension.toLocaleLowerCase();
    return {
      color,
      file_id,
      file_version_id,
      file_type: extension,
      filename: file_name,
      language: user.preferences.locale || 'en',
      mode: fileMode,
      onlyoffice_server: ONLY_OFFICE_SERVER,
      user_id: user.id,
      user_image: user.thumbnail || user.picture || '',
      username: user.username,
      company_id,
      preview,
      editable: !preview,
    };
  };

  private getFileMode = (filename: string): ModeParametersType => {
    let [, extension] = Utils.splitFilename(filename);
    extension = extension.toLocaleLowerCase();

    if (
      [
        'doc',
        'docm',
        'docx',
        'docxf',
        'dot',
        'dotm',
        'dotx',
        'epub',
        'fodt',
        'fb2',
        'htm',
        'html',
        'mht',
        'odt',
        'oform',
        'ott',
        'oxps',
        'pdf',
        'rtf',
        'txt',
        'djvu',
        'xml',
        'xps',
      ].includes(extension)
    ) {
      return {
        mode: 'word',
        color: '#aa5252',
      };
    }

    if (['csv', 'fods', 'ods', 'ots', 'xls', 'xlsb', 'xlsm', 'xlsx', 'xlt', 'xltm', 'xltx'].includes(extension)) {
      return {
        mode: 'cell',
        color: '#40865c',
      };
    }

    if (['fodp', 'odp', 'otp', 'pot', 'potm', 'potx', 'pps', 'ppsm', 'ppsx', 'ppt', 'pptm', 'pptx'].includes(extension)) {
      return {
        mode: 'slide',
        color: '#aa5252',
      };
    }

    return {
      mode: 'text',
      color: 'grey',
    };
  };
}

export default new EditorService();
