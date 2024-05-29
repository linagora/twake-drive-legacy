# Twake Drive - How to enable plugins

## Edit the /backend/node/config/{env}.json file to add the plugin, here is an example with onlyoffice:

```json
{
  "applications": {
    "grid": [
      {
        "name": "Tmail",
        "logo": "/public/img/grid/tmail.png",
        "url": "https://tmail.linagora.com/"
      }
    ],
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

#### Explanation

- `grid` is the list of applications that will be displayed in the grid on top bar, here an example with tmail
- `plugins` is the list of plugins for tdrive, here an example with onlyoffice.
- `plugins.id` is mandatory and must be unique to each plusing
- `plugins.internal_domain` (only if installed inside the same docker and same domain) is the internal domain of the plugin, it must be the same as the one in the docker-compose.yml file
- `plugins.external_prefix` (only if installed outside of the docker) is the external prefix of the plugin. When the frontend will call https://tdrive.app/plugins/onlyoffice/ it will be redirected to the internal_domain.
- **If your server and frontend runs on different urls** then you must replace all the /plugins[...] by http://my_server_url/plugins[...] except for the external_prefix URI.

#### You can also set it using env variables

```
APPLICATIONS='{ "grid": [ { "name": "Tmail", "logo": "/public/img/grid/tmail.png", "url": "https://tmail.linagora.com/" } ], "plugins": [ { "id": "tdrive_onlyoffice", "internal_domain": "http://plugins_onlyoffice:5000/", "external_prefix": "/plugins/onlyoffice/", "api": { "private_key": "apisecret" }, "display": { "tdrive": { "version": 1, "files": { "editor": { "preview_url": "/plugins/onlyoffice/?preview=1", "edition_url": "/plugins/onlyoffice/", "empty_files": [ { "url": "/plugins/onlyoffice/assets/empty.docx", "filename": "Untitled.docx", "name": "ONLYOFFICE Word Document" }, { "url": "/plugins/onlyoffice/assets/empty.xlsx", "filename": "Untitled.xlsx", "name": "ONLYOFFICE Excel Document" }, { "url": "/plugins/onlyoffice/assets/empty.pptx", "filename": "Untitled.pptx", "name": "ONLYOFFICE PowerPoint Document" } ], "extensions": [ "xlsx", "pptx", "docx", "xls", "ppt", "doc", "odt", "ods", "odp", "txt", "html", "csv" ] } } } }, "identity": { "code": "only_office", "name": "Only Office", "icon": "/plugins/onlyoffice/assets/logo.png", "description": null, "website": "http://twake.app/", "categories": [], "compatibility": ["tdrive"] } } ] }'
```

## Add and run the docker container for the plugin

For instance with onlyoffice, you can find the plugin here: https://github.com/linagora/Twake-Plugin-Onlyoffice

In the docker-compose.yml you can add the following:

```yaml
plugins_onlyoffice:
  image: onlyoffice-connector
  restart: unless-stopped
  environment:
    - SERVER_PORT=5000
    - SERVER_PREFIX=/plugins/onlyoffice/
    - CREDENTIALS_ENDPOINT=http://node/
    - ONLY_OFFICE_SERVER=https://onlyoffice.server.come/
    - CREDENTIALS_ID=tdrive_onlyoffice
    - CREDENTIALS_SECRET=apisecret
```

Note:

- Make sure the network is shared with node
- Make sure the service name matches the internal_domain in the config file

## Run everything

When starting the docker-compose, the plugin will be available on https://[frontend]/plugins/onlyoffice/ you can test everything works by opening the url https://[frontend]/plugins/onlyoffice/assets/logo.png .

If the logo displays, then open Twake Drive, and see if you can create a new OnlyOffice Spreadsheet when clicking on "New".
