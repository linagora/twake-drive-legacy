---
description: Documents API
---

# Navigation and drive capabilities

## Fetch a drive item

Used to fetch a drive item

**URL** : `/internal/services/documents/v1/companies/:company_id/item/:id`

**Method** : `GET`

**Auth required** : Yes

### Success Response

**Code** : `200 OK`

**Content example**

```javascript
{
  item: {
    id: string;
    company_id: string;

    parent_id: string;
    in_trash: boolean;
    is_directory: string;
    name: string;
    extension: string;
    description: string;
    tags: [];

    added: string;
    last_modified: string;
    last_version_cache: DriveItemVersion;

    access_info: DriveItemAccessInfo;
  }
  versions: {
    id: string;

    provider: string | "drive" | "internal";
    file_id: string;
    file_metadata: FileMetadata;

    date_added: number;
    creator_id: string;
    application_id: string;
  }
  [];
  children: {
    id: string;
    company_id: string;

    parent_id: string;
    in_trash: boolean;
    is_directory: string;
    name: string;
    extension: string;
    description: string;
    tags: [];

    added: string;
    last_modified: string;
    last_version_cache: DriveItemVersion;

    access_info: DriveItemAccessInfo;
  }
  [];
}
```

### Error Responses

If the item cannot be fetched the server will return an error with one of the following status codes:

- 401 Unauthorized - The user is not authorized.
- 500 Internal Server Error - An error occurred while performing the operation.

## Create a drive item

Used to create a drive item

**URL** : `/internal/services/documents/v1/companies/:company_id/item`

**Method** : `POST`

**Headers**: `Content-Type: application/json` OR `Content-Type: multipart/form-data`

**Auth required** : Yes

**Data constraints**

```javascript
{
  item: {
      id: string;
      company_id: string;

      parent_id: string;
      in_trash: boolean;
      is_directory: string;
      name: string;
      extension: string;
      description: string;
      tags: [];

      added: string;
      last_modified: string;
      last_version_cache: DriveItemVersion;

      access_info: DriveItemAccessInfo;
  },
  version: {
      id: string;

      provider: string | 'drive' | 'internal';
      file_id: string;
      file_metadata: FileMetadata;

      date_added: number;
      creator_id: string;
      application_id: string;
  },
  file?: File // The multipart/form-data file to be uploaded ( optional )
}
```

### Success Response

**Code** : `200 OK`

### Error Responses

If the request is missing required fields or the item cannot be created, the server will return an error with one of the following status codes:

- 400 Bad Request - The request is missing required fields.
- 401 Unauthorized - The user is not authorized.
- 500 Internal Server Error - An error occurred while performing the operation.

## Update a drive item

Used to update a drive item

**URL** : `/internal/services/documents/v1/companies/:company_id/item/:id`

**Method** : `POST`

**Auth required** : Yes

**Data constraints**

```javascript
{
  id: string;
  company_id: string;

  parent_id: string;
  in_trash: boolean;
  is_directory: string;
  name: string;
  extension: string;
  description: string;
  tags: [];

  added: string;
  last_modified: string;
  last_version_cache: DriveItemVersion;

  access_info: DriveItemAccessInfo;
}
```

### Success Response

**Code** : `200 OK`

### Error Responses

If the request is missing required fields or the item cannot be updated, the server will return an error with one of the following status codes:

- 400 Bad Request - The request is missing required fields.
- 401 Unauthorized - The user is not authorized.
- 500 Internal Server Error - An error occurred while performing the operation.

## Delete a drive item

Used to delete a drive item

**URL** : `/internal/services/documents/v1/companies/:company_id/item/:id`

**Method** : `DELETE`

**Auth required** : Yes

### Success Response

**Code** : `200 OK`

## Create a drive item version

Used to create a drive item version

**URL** : `/internal/services/documents/v1/companies/:company_id/item/:id/version`

**Method** : `POST`

**Auth required** : Yes

**Data constraints**

```javascript
{
  id: string;

  provider: string | 'drive' | 'internal';
  file_id: string;
  file_metadata: {
      source: 'internal' | 'drive' | string;
      external_id: string | any;

      name?: string;
      mime?: string;
      size?: number;
      thumbnails?: {
          index: number;
          id: string;

          type: string;
          size: number;
          width: number;
          height: number;

          url: string;
          full_url?: string;
      }[];
  };

  date_added: number;
  creator_id: string;
  application_id: string;
}
```

### Success Response

**Code** : `200 OK`

# Download

## Get a download token

Before to download, if you can't pass an authorisation token (for example in the browser context) you can generate a token that you will pass in the query string to download the file using the next routes.

**URL** : `/internal/services/documents/v1/companies/:company_id/item/download/token?items=id1,id2,id3&version_id:optional_id`

**Method** : `GET`

**Auth required** : Yes

### Success Response

```
{
  "token": string
}
```

## Download

Shortcut to download a file (you can also use the file-service directly).
If the item is a folder, a zip will be automatically generated.

**URL** : `/internal/services/documents/v1/companies/:company_id/item/:id/download?version_id=:optional_id`

**Method** : `GET`

**Auth required** : Yes

## Zip download

Used to create a zip archive containing the requested drive items ( files and folders ).

**URL** : `/internal/services/documents/v1/companies/:company_id/item/download/zip?items=id1,id2,id3`

**Method** : `GET`

**Auth required** : Yes

# Tabs (for Twake Drive)
<!-- TODO[REMOVE SECTION] -->
If you want to use the TDrive tabs, you must store the configuration of the tabs in the database.
<!-- TODO[REMOVE SECTION] -->
## Get tab configuration
<!-- TODO[REMOVE SECTION] -->
Get a tab configuration to get the attached folder/document id.

**URL** : `/internal/services/documents/v1/companies/:company_id/tabs/:id`

**Method** : `GET`

**Auth required** : Yes

### Success Response

```
{
  "company_id": string;
  "tab_id": string;
  "channel_id": string;
  "item_id": string;
  "level": "read" | "write";
}
```

## Set tab configuration
<!-- TODO[REMOVE SECTION] -->
Get a tab configuration to get the attached folder/document id.

**URL** : `/internal/services/documents/v1/companies/:company_id/tabs/:id`

**Method** : `POST`

**Auth required** : Yes

**Data constraints** :

```
{
  "company_id": string;
  "tab_id": string;
  "channel_id": string;
  "item_id": string;
  "level": "read" | "write";
}
```

### Success Response

```
{
  "company_id": string;
  "tab_id": string;
  "channel_id": string;
  "item_id": string;
  "level": "read" | "write";
}
```
