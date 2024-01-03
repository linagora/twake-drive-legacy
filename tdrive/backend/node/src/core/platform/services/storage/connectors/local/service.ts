import { Readable } from "stream";
import { createWriteStream, createReadStream, existsSync, mkdirSync, statSync, rmSync } from "fs";
import p from "path";
import { rm } from "fs/promises"; // Do not change the import, this is not the same function import { rm } from "fs"
import { StorageConnectorAPI, WriteMetadata } from "../../provider";
import fs from "fs";

export type LocalConfiguration = {
  path: string;
};

export default class LocalConnectorService implements StorageConnectorAPI {
  configuration: LocalConfiguration;

  constructor(localConfiguration: LocalConfiguration) {
    this.configuration = localConfiguration;
  }

  write(relativePath: string, stream: Readable): Promise<WriteMetadata> {
    const path = this.getFullPath(relativePath);

    const directory = p.dirname(path);
    if (!existsSync(directory)) {
      mkdirSync(directory, {
        recursive: true,
      });
    }

    return new Promise((resolve, reject) => {
      const file = createWriteStream(path);
      file
        .on("error", function (err) {
          reject(err);
        })
        .on("finish", () => {
          const stats = statSync(path);
          resolve({
            size: stats.size,
          });
        });
      stream.pipe(file);
    });
  }

  async read(path: string): Promise<Readable> {
    const fullPath = this.getFullPath(path);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File doesn't exists ${fullPath}`);
    }
    return createReadStream(fullPath);
  }

  async remove(path: string): Promise<boolean> {
    try {
      if (existsSync(this.getFullPath(path))) {
        rmSync(this.getFullPath(path));
        return true;
      }
    } catch (err) {}
    return false;
  }

  private getFullPath(path: string): string {
    return `${this.configuration.path}/${path}`.replace(/\/{2,}/g, "/");
  }

  delete(path: string): Promise<void> {
    return rm(this.getFullPath(path), { recursive: false, force: true });
  }
}
