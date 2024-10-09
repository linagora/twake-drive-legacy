# Twake Drive v1.0.4

## Features

- Added translation for context menu
- Removed cumulative queries to the database First step to the transactions in PostgreSQL
- Ignore errors during nextcloud migration to be able to import files partially
- OnlyOffice rework

## Fixes and Improvements

- Fix big file (with multiple chunks) download
- Fix bug with postgres support when uploading files
- Fix infinite scroll for shared with me
- Fix OpenSearch e2e test
- Fix build CI

# Twake Drive v1.0.3

## Features

- Infinite scrolling in files list view
- Sort files chronologically
- Added Left and Right buttons in the preview gallery

## Fixes and Improvements

- Folders with large numbers of files now work
- OIDC logout
- Dark mode related fixes
- Rework of share and permissions dialog
- Removed Cassandra support
- A large number of minor fixes
- Translation of user notifications

# Twake Drive v1.0.2

## Features

- New “Create” context menu new icons
- CLI tool to reindex search database
- Handling quota limit error
- 
## BugFixes and improvements
- Handling quota limit error
- Refactored starting docker-compose file
- Fix navigation for shared link view

# Twake Drive v1.0.1

## Features

- New Version Semantics
- Usage quota settings 
- PostgreSQL support as a metadata database 
- OpenSearch support as a search database
- New API to check file storage consistency
- UX improvements
  - Remove the switcher from breadcrumbs
  - Improved translations
- Be able to use SMTP transport without TLS
- Do not display deleted items in the shared with me section

## BugFixes
- Fix preview of the files on mobile and web
- Malformed URL when you share a file
- ...

# Twake Drive v2023.Q3.012

## Features

- Personal and shared drive
- View files shared with me
- Drag and drop multiple files to upload
- Drag and drop to move files in Drive
- Click to see preview and details
- Details include : description, name, labels
- Search files with full text search
- Download, open, duplicate, move in trash
- Edit files with OnlyOffice integration
