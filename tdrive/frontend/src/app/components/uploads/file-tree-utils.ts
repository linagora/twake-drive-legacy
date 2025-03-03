import { number } from 'prop-types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type TreeItem = { [key: string]: { root: string; file: File } | TreeItem };

export type FileTreeObject = {
  tree: TreeItem;
  documentsCount: number;
  totalSize: number;
  sizePerRoot: { [key: string]: number };
};

export const getFilesTree = (
  event: Event & { dataTransfer: DataTransfer },
  fcb?: (tree: any, documentsCount: number, totalSize: number) => void,
): Promise<FileTreeObject> => {
  return new Promise<FileTreeObject>(function (resolve) {
    function newDirectoryApi(input: DataTransfer, cb: (files?: File[], paths?: string[]) => void) {
      const fd: any[] = [],
        files: any[] = [];
      const iterate = function (entries: any[], path: string, resolve: (v: any[]) => void) {
        const promises: any[] = [];
        entries.forEach(function (entry: any) {
          promises.push(
            new Promise(function (resolve) {
              if ('getFilesAndDirectories' in entry) {
                entry.getFilesAndDirectories().then(function (entries: any[]) {
                  iterate(entries, entry.path + '/', resolve);
                });
              } else {
                if (entry.name) {
                  const p = (path + entry.name).replace(/^[/\\]/, '');
                  fd.push(entry);
                  files.push(p);

                  if (files.length > 1000000) {
                    return false;
                  }
                }
                resolve(true);
              }
            }),
          );
        });

        if (files.length > 1000000) {
          return false;
        }

        Promise.all(promises).then(resolve);
      };
      (input as any).getFilesAndDirectories().then(function (entries: any) {
        new Promise(function (resolve) {
          iterate(entries, '/', resolve);
        }).then(cb.bind(null, fd, files));
      });
    }

    // old prefixed API implemented in Chrome 11+ as well as array fallback
    function arrayApi(input: DataTransfer, cb: (files?: File[], paths?: string[]) => void) {
      const fd: any[] = [],
        files: any[] = [];
      [].slice.call(input.files).forEach(function (file: File) {
        fd.push(file);
        files.push(file.webkitRelativePath || file.name);

        if (files.length > 1000000) {
          return false;
        }
      });

      if (files.length > 1000000) {
        return false;
      }

      cb(fd, files);
    }

    // old drag and drop API implemented in Chrome 11+
    function entriesApi(
      items: DataTransferItemList,
      cb: (files?: File[], paths?: string[]) => void,
    ) {
      const fd: any[] = [],
        files: any[] = [],
        rootPromises: any[] = [];

      function readEntries(entry: any, reader: any, oldEntries: any, cb: any) {
        const dirReader = reader || entry.createReader();
        dirReader.readEntries(function (entries: any) {
          const newEntries = oldEntries ? oldEntries.concat(entries) : entries;
          if (entries.length) {
            setTimeout(readEntries.bind(null, entry, dirReader, newEntries, cb), 0);
          } else {
            cb(newEntries);
          }
        });
      }

      function readDirectory(entry: any, path: null | string, resolve: (v: any) => void) {
        if (!path) path = entry.name;
        readEntries(entry, 0, 0, function (entries: any[]) {
          const promises: Promise<any>[] = [];
          entries.forEach(function (entry: any) {
            promises.push(
              new Promise(function (resolve) {
                if (entry.isFile) {
                  entry.file(function (file: File) {
                    const p = path + '/' + file.name;
                    fd.push(file);
                    files.push(p);
                    if (files.length > 1000000) {
                      return false;
                    }
                    resolve(true);
                  }, resolve.bind(null, true));
                } else readDirectory(entry, path + '/' + entry.name, resolve);
              }),
            );
          });
          Promise.all(promises).then(resolve.bind(null, true));
        });
      }

      let timeBegin = Date.now();
      [].slice.call(items).forEach(function (entry: any) {
        entry = entry.webkitGetAsEntry();
        if (entry) {
          rootPromises.push(
            new Promise(function (resolve) {
              if (entry.isFile) {
                entry.file(function (file: File) {
                  fd.push(file);
                  files.push(file.name);
                  if (files.length > 1000000) {
                    return false;
                  }
                  resolve(true);
                }, resolve.bind(null, true));
              } else if (entry.isDirectory) {
                const timeToRead = Date.now();
                readDirectory(entry, null, resolve);
              }
            }),
          );
        }
      });

      if (files.length > 1000000) {
        return false;
      }

      timeBegin = Date.now();
      Promise.all(rootPromises).then(cb.bind(null, fd, files));
    }

    const cb = function (event: Event, files: File[], paths?: string[]) {
      const documents_number = paths ? paths.length : 0;
      let total_size = 0;
      const tree: any = {};
      const size_per_root: { [key: string]: number } = {};
      (paths || []).forEach(function (path, file_index) {
        let dirs = tree;
        const real_file = files[file_index];

        total_size += real_file.size;

        path.split('/').forEach(function (dir, dir_index) {
          if (dir.indexOf('.') === 0) {
            return;
          }
          if (dir_index === path.split('/').length - 1) {
            const root = path.split('/')[0];
            dirs[dir] = {
              file: real_file,
              root,
            };
            // Calculate the total size of each root
            if (!size_per_root[root]) {
              size_per_root[root] = real_file.size;
            } else {
              size_per_root[root] += real_file.size;
            }
          } else {
            if (!dirs[dir]) {
              dirs[dir] = {};
            }
            dirs = dirs[dir];
          }
        });
      });
      resolve({
        tree,
        documentsCount: documents_number,
        totalSize: total_size,
        sizePerRoot: size_per_root,
      });
    };

    // Handle file input based on the event type, starting with `dataTransfer` for drag-and-drop events
    if (event.dataTransfer) {
      const dt = event.dataTransfer;

      // When dragging files into the browser, `dataTransfer.items` contains a list of the dragged items.
      // `webkitGetAsEntry` allows access to a directory-like API, letting us explore folders and subfolders.
      // This means we can recursively scan for files in folders without relying on manual user input.
      if (dt.items && dt.items.length && 'webkitGetAsEntry' in dt.items[0]) {
        // Use `entriesApi` to iterate through items, handling directories and files.
        // This is ideal for cases where users drag entire folder structures into the app.
        entriesApi(dt.items, (files, paths) => cb(event, files || [], paths));
      }
      // If `getFilesAndDirectories` is available on `dataTransfer`, it indicates a newer API is supported.
      // This API directly provides both files and directories, making it easier to process structured uploads.
      else if ('getFilesAndDirectories' in dt) {
        // Use `newDirectoryApi` to process files and directories in a standardized way.
        newDirectoryApi(dt, (files, paths) => cb(event, files || [], paths));
      }
      // If neither of the advanced APIs (`webkitGetAsEntry` or `getFilesAndDirectories`) is available,
      // fall back to using the basic `dataTransfer.files` property.
      // This works only for files, meaning directories won’t be detected or handled.
      else if (dt.files) {
        // Use `arrayApi` to process the flat list of files.
        arrayApi(dt, (files, paths) => cb(event, files || [], paths));
      }
      // If no files or directories can be detected (e.g., if the user drops something invalid),
      // return an empty response to ensure the application doesn’t break.
      else cb(event, [], []);
    }
    // If the event comes from a file input field rather than drag-and-drop (`event.target` exists):
    else if (event.target) {
      const t = event.target as any;

      // When a file input element (`<input type="file">`) is used, it stores the selected files in `target.files`.
      // This is the standard way for users to upload files through a file picker dialog.
      if (t.files && t.files.length) {
        // Process the selected files as a flat array using `arrayApi`.
        arrayApi(t, (files, paths) => cb(event, files || [], paths));
      }
      // If the input element supports `getFilesAndDirectories`, handle structured uploads.
      // This could occur in custom or enhanced file inputs that allow folder selection.
      else if ('getFilesAndDirectories' in t) {
        newDirectoryApi(t, (files, paths) => cb(event, files || [], paths));
      }
      // If no valid files or directories can be detected, return an empty response.
      else {
        cb(event, [], []);
      }
    }
    // Fallback for cases where neither `dataTransfer` nor `target` is available:
    // This typically occurs in unusual scenarios, such as handling a manually triggered upload.
    else {
      // If a callback (`fcb`) is provided, call it with the first file found (if any).
      // This is a last-resort assumption that `event.target.files` has at least one valid file.
      fcb && fcb([(event.target as any).files[0]], 1, (event.target as any).files[0].size);

      // Resolve the promise with a default response, treating the single file as the entire tree.
      resolve({
        tree: (event.target as any).files[0],
        documentsCount: 1,
        totalSize: (event.target as any).files[0].size,
        sizePerRoot: { [(event.target as any).files[0].name]: (event.target as any).files[0].size },
      });
    }
  });
};

export const getFileIdsInTree = (tree: FileTreeObject['tree']): string[] => {
  const fileIds: string[] = [];
  for (const directory of Object.keys(tree)) {
    if (tree[directory].root) {
      fileIds.push(tree[directory].root as string);
    } else {
      getFileIdsInTree(tree[directory] as FileTreeObject['tree']);
    }
  }

  return fileIds;
}
