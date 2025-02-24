import { Readable } from "stream";
import { createWriteStream, createReadStream, existsSync, mkdirSync, statSync, rmSync } from "fs";
import p from "path";
import { rm } from "fs/promises"; // Do not change the import, this is not the same function import { rm } from "fs"
import { StorageConnectorAPI, WriteMetadata } from "../../provider";
import fs from "fs";
import { logger } from "../../../../framework/logger";
import { randomUUID } from "crypto";
import { TDiagnosticResult, TServiceDiagnosticDepth } from "../../../../framework/api/diagnostics";

export type LocalConfiguration = {
  id: string;
  path: string;
};

export default class LocalConnectorService implements StorageConnectorAPI {
  id: string;
  configuration: LocalConfiguration;

  constructor(localConfiguration: LocalConfiguration) {
    this.configuration = localConfiguration;
    this.id = this.configuration.id;
    if (!this.id) {
      this.id = randomUUID();
      logger.info(`Identifier for local storage haven't been set, initializing to '${this.id}'`);
    }
  }

  getId() {
    return this.id;
  }

  async getDiagnostics(depth: TServiceDiagnosticDepth): Promise<TDiagnosticResult> {
    switch (depth) {
      case TServiceDiagnosticDepth.alive:
      case TServiceDiagnosticDepth.stats_basic:
      case TServiceDiagnosticDepth.stats_track:
      case TServiceDiagnosticDepth.stats_deep:
        return { ok: true, empty: true };

      default:
        throw new Error(`Unexpected TServiceDiagnosticDepth: ${JSON.stringify(depth)}`);
    }
  }

  write(relativePath: string, stream: Readable): Promise<WriteMetadata> {
    const path = this.getFullPath(relativePath);
    logger.trace(`Writing file ${path}`);

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
          logger.error(`Error ${err.message} during writing file ${path}`);
          reject(err);
        })
        .on("finish", () => {
          const stats = statSync(path);
          logger.trace(`File ${path} have been written`);
          resolve({
            size: stats.size,
          });
        });
      stream.pipe(file);
    });
  }

  async read(path: string): Promise<Readable> {
    logger.trace(`Reading file ... ${path}`);
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

  async exists(path: string): Promise<boolean> {
    logger.trace(`Reading file ... ${path}`);
    const fullPath = this.getFullPath(path);
    return fs.existsSync(fullPath);
  }

  async enumeratePathsForFile(filePath: string): Promise<string[]> {
    return (await fs.promises.readdir(this.getFullPath(filePath), { recursive: true })).map(
      item => filePath + "/" + item,
    );
  }
}
