---
description: Application models for backend
---

# Database models

**applications**

Represent an application in the database

```Typescript
export default interface Application {
  id: string;
  internal_domain?: string;
  external_prefix?: string;
  company_id: string;
  is_default: boolean;
  identity: ApplicationIdentity;
  api: ApplicationApi;
  access: ApplicationAccess;
  display: ApplicationDisplay;
  publication: ApplicationPublication;
  stats: ApplicationStatistics;
}

export type ApplicationIdentity = {
  code: string;
  name: string;
  icon: string;
  description: string;
  website: string;
  categories: string[];
  compatibility: "twake"[];
  repository?: string;
};

export type ApplicationPublication = {
  published: boolean;
  requested: boolean;
};

type ApplicationStatistics = {
  createdAt: number;
  updatedAt: number;
  version: number;
};

type ApplicationApi = {
  hooksUrl: string;
  allowedIps: string;
  privateKey: string;
};

type ApplicationAccess = {
  privileges: string[];
  capabilities: string[];
  hooks: string[];
};

type ApplicationDisplay = {
  tdrive: {
    "version": 1,

    "files": {
      "preview": {
        "url": "", //Url to preview file (full screen or inline)
        "inline": true,
        "main_ext": ["docx", "xlsx"], //Main extensions app can read
        "other_ext": ["txt", "html"] //Secondary extensions app can read
      },
      "actions": [ //List of action that can apply on a file
        {
          "name": "string",
          "id": "string"
        }
      ]
    }
  }
};
```
