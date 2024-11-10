/* eslint-disable @typescript-eslint/no-explicit-any */
type TreeItem = { [key: string]: File | TreeItem };

export type FileTreeObject = {
  tree: TreeItem;
  documentsCount: number;
  totalSize: number;
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
                readDirectory(entry, null, resolve);
              }
            }),
          );
        }
      });

      if (files.length > 1000000) {
        return false;
      }

      Promise.all(rootPromises).then(cb.bind(null, fd, files));
    }

    const cb = function (event: Event, files: File[], paths?: string[]) {
      const documents_number = paths ? paths.length : 0;
      let total_size = 0;
      const tree: any = {};
      (paths || []).forEach(function (path, file_index) {
        let dirs = tree;
        const real_file = files[file_index];

        total_size += real_file.size;

        path.split('/').forEach(function (dir, dir_index) {
          if (dir.indexOf('.') === 0) {
            return;
          }
          if (dir_index === path.split('/').length - 1) {
            dirs[dir] = real_file;
          } else {
            if (!dirs[dir]) {
              dirs[dir] = {};
            }
            dirs = dirs[dir];
          }
        });
      });

      fcb && fcb(tree, documents_number, total_size);
      resolve({ tree, documentsCount: documents_number, totalSize: total_size });
    };

    if (event.dataTransfer) {
      const dt = event.dataTransfer;
      if (dt.items && dt.items.length && 'webkitGetAsEntry' in dt.items[0]) {
        entriesApi(dt.items, (files, paths) => cb(event, files || [], paths));
      } else if ('getFilesAndDirectories' in dt) {
        newDirectoryApi(dt, (files, paths) => cb(event, files || [], paths));
      } else if (dt.files) {
        arrayApi(dt, (files, paths) => cb(event, files || [], paths));
      } else cb(event, [], []);
    } else if (event.target) {
      const t = event.target as any;
      if (t.files && t.files.length) {
        arrayApi(t, (files, paths) => cb(event, files || [], paths));
      } else if ('getFilesAndDirectories' in t) {
        newDirectoryApi(t, (files, paths) => cb(event, files || [], paths));
      } else {
        cb(event, [], []);
      }
    } else {
      fcb && fcb([(event.target as any).files[0]], 1, (event.target as any).files[0].size);
      resolve({
        tree: (event.target as any).files[0],
        documentsCount: 1,
        totalSize: (event.target as any).files[0].size,
      });
    }
  });
};
