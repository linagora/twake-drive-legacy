---
description: Documents database models
---

# Database models

**DriveFile**

```TypeScript
export class DriveFile {
  company_id: string;
  id: string;
  parent_id: string;
  is_in_trash: boolean;
  is_directory: boolean;
  name: string;
  extension: string;
  description: string;
  tags: string[];
  added: number;
  last_modified: number;
  access_info: AccessInformation;
  content_keywords: string;
  creator: string;
  size: number;
  last_version_cache: Partial<FileVersion>;
  scope: DriveScope;
}

type AccessInformation = {
  public: {
    token: string;
    password: string;
    expiration: number;
    level: publicAccessLevel;
  };
  entities: AuthEntity[];
};

type AuthEntity = {
  type: "user" | "channel" | "company" | "folder";
  id: string | "parent";
  level: publicAccessLevel | DriveFileAccessLevel;
};
```

**FileVersion**

```Typescript
export class FileVersion {
  drive_item_id: string;
  id: string;
  provider: "internal" | "drive" | string;
  file_metadata: DriveFileMetadata;
  date_added: number;
  creator_id: string;
  application_id: string;
  realname: string;
  key: string;
  mode: string | "OpenSSL-2";
  file_size: number;
  filename: string;
  data: unknown;
}


type DriveFileMetadata = {
  source: "internal" | "drive" | string;
  external_id: string;

  name?: string;
  mime?: string;
  size?: number;
  thumbnails?: DriveFileThumbnail;
};

type DriveFileThumbnail = {
  index: number;
  id: string;

  type: string;
  size: number;
  width: number;
  height: number;

  url: string;
  full_url?: string;
};
```
