import {
  FileTypeArchiveIcon,
  FileTypeDocumentIcon,
  FileTypeSpreadsheetIcon,
  FileTypeMediaIcon,
  FileTypeSlidesIcon,
  FileTypePdfIcon,
} from 'app/atoms/icons-colored';

// Map mime types to their respective JSX icon elements
export const fileTypeIconsMap: Record<string, JSX.Element> = {
  pdf: <FileTypePdfIcon />,
  doc: <FileTypeDocumentIcon />,
  docx: <FileTypeDocumentIcon />,
  xls: <FileTypeSpreadsheetIcon />,
  xlsx: <FileTypeSpreadsheetIcon />,
  ppt: <FileTypeSlidesIcon />,
  pptx: <FileTypeSlidesIcon />,
  zip: <FileTypeArchiveIcon />,
  rar: <FileTypeArchiveIcon />,
  tar: <FileTypeArchiveIcon />,
  '7z': <FileTypeArchiveIcon />,
  bz: <FileTypeArchiveIcon />,
  bz2: <FileTypeArchiveIcon />,
  gz: <FileTypeArchiveIcon />,
  mp4: <FileTypeMediaIcon />,
  mpeg: <FileTypeMediaIcon />,
  ogg: <FileTypeMediaIcon />,
  webm: <FileTypeMediaIcon />,
  mov: <FileTypeMediaIcon />,
};
