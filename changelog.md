# Twake Drive v1.0.7-rc15

## Features

- Add flag to always allow share by link

# Twake Drive v1.0.7-rc12

## Fixes and Improvements

- Fix sessions could not remove after delete account success
- Fix bug cannot update email with account remote

# Twake Drive v1.0.7

## Features

- Big folder upload with new upload modal
- Added root folder for all uploads, document creation, and cleanup after
- Add testing identifier to new upload modal
- Add delete user endpoint.
- Added migration cli commands for user(s) and file(s).

## Fixes and Improvements

- Print memory usage periodically in the backend
- Rollup final script file to add dependencies after
- Made performance test runnable
- Drive items are now properly removed from the search index when deleted
- Faster listing for trash
- Fix file/folder upload picker.
- Config cozy offer for user(s) migration.
- Fix default user locale with preferences for user(s) migration.

# Twake Drive v1.0.6

## Features

- Live multiple S3 backends with log-based reconciliation
- User update API

## Fixes and Improvements

- Update of quota is severely optimised
- Infinite scrolling automatic until a scroll bar is visible
- Accounts menu re-design
- Various layout fixes for small screens and large contents
- Tuning warnings for AV status of un-scanned files
- Fix for preview breaking when switching too fast between files
- Added E2E testing identifiers on key components for i18n and style resiliance
- ZIP download time to first byte reduced to linear, and S3 throttling
- Fix to delete files created by applications

# Twake Drive v1.0.5

*Note: `-rc2` should be 1.0.6, but to align with internal release cycle numbering, we
will just continue 1.0.5 for this release. Canditates through `rc11` were hotfixes*

## Features

- AntiVirus - Uploaded files are now scanned by ClamAV
- Reveal file in location

## Fixes and Improvements

- Push client error logs to the server logs
- Tolerate some configuration qwirks (like extra `/`s)
- Move operations now self-rename if target exists
- Minor UI fixes related to the search bar, pagination,
  sorting by size, no more loading segment, and move
  operation from a public link
- Email link when folder updated by public link fixed
- Fix download for Safari users who block popups
- Fix for OnlyOffice based on postgres

# Twake Drive v1.0.5-rc1

## Features

- Updated the navigation bar/app grid
- Added FileVersion.filename and FileVersion.file_metadata.name to output to backend cli
- Added Shared with me feature flag
- Added offset pagination to db connector
- Added healthchecks to the docker compose services used in CI testing removed scylladb.
- Sorted all locales json keys, as per jq --sort-keys

## Fixes and Improvements

- Fix translation of disk usage to plural tolerant
- Fix Vietnamese code to correct ISO of "vi", added to selector in account settings
- Fix onlyoffice filename corrupted after editing
- Fix UI bugs related to borders in lists
- Fix set rights modal had similar border issues as browser
- Fix file browser vertical borders (and fix react warning)
- Fix only office filename getting overwritten at session end


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

## Hotfixes
  - `v1.0.4-hf1`:
    - Fix typo in French translation
  - `v1.0.4-hf3`:
    - Add collation fix.
    - Cli db seed tool


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
