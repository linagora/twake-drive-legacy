# OnlyOffice connector plugin for Twake Drive

This server sits between the backend server of Twake Drive, and the document editing service of OnlyOffice.

Documentation of the [API used with OnlyOffice is here](https://api.onlyoffice.com/editors/howitworks).

## Running principle

- The connector is added as a plugin application to Twake Drive's configuration
- When a user
  - Creates a file from the templates
    - The file is downloaded by the browser, proxied through the frontend and then backend, to the connector's static assets.
    - The file is then created in Twake Drive by the browser, as any normal file would be
  - Edits or Previews a file that matches the extensions in the configuration of Twake Drive's backend
    - Twake Drive creates a JWT for the current user, then opens in an IFrame either the edit or preview URLs from the configuration.
    - These should point to something ultimately proxied to the view's routes in this connector's `IndexController`
      - The view instantiates [the JS client DocsAPI](https://api.onlyoffice.com/editors/advanced), providing it with URLs to read and write the document. This JS is served directly from the OnlyOffice server which must be accessible to client browsers.
        - The inline configuration provides a read and a write URL to the DocsAPI editor, these point to the routes of `OnlyOfficeController`.
      - When all the clients have disconnected from the editing session on the OnlyOffice document editing service, the OnlyOffice server will call the `callbackUrl` of this connector.
        - The connector then downloads the new file from Only Office, and creates a new version in Twake Drive.
- Periodically gets a list of forgotten files and updates the backend with them

## Configuration example

Let's assume the servers can be contacted at (all but the backend are called directly by the user browser at the same URL as internal calls are made):

- Twake Drive backend: http://backend:4000
- This connector: http://plugins_onlyoffice:5000
- OnlyOffice: http://onlyoffice:8090

### Environment variables for running the connector

- `SERVER_PORT=5000`
- `SERVER_PREFIX=/plugins/onlyoffice/`
- `CREDENTIALS_ENDPOINT=http://backend/`
- `ONLY_OFFICE_SERVER=https://onlyoffice/`
- `CREDENTIALS_ID=tdrive_onlyoffice`
- `CREDENTIALS_SECRET=apisecret`

### Backend configuration `/backend/node/config/{env}.json`

```json
{
  "applications": {
    "plugins": [
      {
        "id": "tdrive_onlyoffice",
        "internal_domain": "http://plugins_onlyoffice:5000/",
        "external_prefix": "/plugins/onlyoffice/",
        "api": {
          "private_key": "apisecret"
        },
        "display": {
          "tdrive": {
            "version": 1,
            "files": {
              "editor": {
                "preview_url": "/plugins/onlyoffice/?preview=1",
                "edition_url": "/plugins/onlyoffice/",
                "empty_files": [
                  {
                    "url": "/plugins/onlyoffice/assets/empty.docx",
                    "filename": "Untitled.docx",
                    "name": "ONLYOFFICE Word Document"
                  },
                  {
                    "url": "/plugins/onlyoffice/assets/empty.xlsx",
                    "filename": "Untitled.xlsx",
                    "name": "ONLYOFFICE Excel Document"
                  },
                  {
                    "url": "/plugins/onlyoffice/assets/empty.pptx",
                    "filename": "Untitled.pptx",
                    "name": "ONLYOFFICE PowerPoint Document"
                  }
                ],
                "extensions": [
                  "xlsx",
                  "pptx",
                  "docx",
                  "xls",
                  "ppt",
                  "doc",
                  "odt",
                  "ods",
                  "odp",
                  "txt",
                  "html",
                  "csv"
                ]
              }
            }
          }
        },
        "identity": {
          "code": "only_office",
          "name": "Only Office",
          "icon": "/plugins/onlyoffice/assets/logo.png",
          "description": null,
          "website": "http://twake.app/",
          "categories": [],
          "compatibility": ["tdrive"]
        }
      }
    ]
  }
}
```
