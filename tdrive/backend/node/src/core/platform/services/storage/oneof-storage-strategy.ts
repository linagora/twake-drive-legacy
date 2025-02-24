import { Readable, Stream, PassThrough } from "stream";
import {
  DeleteOptions,
  ReadOptions,
  StorageConnectorAPI,
  WriteMetadata,
  WriteOptions,
} from "../storage/provider";
import { logger } from "../../../platform/framework";
import { FileNotFountException, WriteFileException } from "./exceptions";
import type { TDiagnosticResult, TServiceDiagnosticDepth } from "../../framework/api/diagnostics";

/**
 * OneOfStorageStrategy is responsible for managing multiple storage backends.
 * It writes to, reads from, removes, and checks for the existence of files
 * across multiple storage systems.
 *
 * WARNING: Be careful using this strategy. There is a very big probability that
 * all storages won't be synchronized. You need to use external synchronization
 * tools like rclone to keep them in sync.
 * As far as all the objects in a storage are immutable you won't have inconsistent
 * state of the object except it could've been deleted, and it's still exists in one
 * of the storages. So you will need to have external procedures to clean up storages
 * and make "garbage" collection.
 */
export class OneOfStorageStrategy implements StorageConnectorAPI {
  id: string;

  constructor(private readonly storages: StorageConnectorAPI[]) {}

  getId() {
    if (!this.id) {
      this.id = this.storages.map(s => s.getId()).join("_");
    }
    return this.id;
  }

  async getDiagnostics(depth: TServiceDiagnosticDepth): Promise<TDiagnosticResult> {
    const states = await Promise.all(
      this.storages.map(async s => ({ id: s.getId(), ...(await s.getDiagnostics(depth)) })),
    );
    return {
      ...(states.every(s => s.ok) ? {} : { warn: "not_all_storages_ok" }),
      ok: states.some(s => s.ok),
      states: states,
    };
  }

  /**
   * Writes a file to all configured storages.
   * The write operation is considered successful if one of the storage succeed.
   * @param path - The path where the file should be written.
   * @param stream - The input stream to be written to storages.
   * @param options - Write option: chunk number, encryption key, etc ...
   * @throws Error if the write operation fails for one or more storages.
   */
  write = async (path: string, stream: Stream, options?: WriteOptions): Promise<WriteMetadata> => {
    logger.debug("Creating streams for all storages ...");
    const passThroughStreams = this.storages.map(() => new PassThrough());

    // destroy all streams if there is an error in the input stream
    stream.on("error", err => {
      logger.error(err, "Error in input stream, destroying all write streams");
      passThroughStreams.forEach(stream => stream.destroy(err));
    });

    // Pipe the input stream to each PassThrough stream
    stream
      .pipe(new PassThrough())
      .on("data", chunk => {
        passThroughStreams.forEach(stream => stream.write(chunk));
      })
      .on("end", () => {
        passThroughStreams.forEach(stream => stream.end());
      });

    // Write to all storages with error handling
    const writeResults = await Promise.allSettled(
      this.storages.map((storage, index) =>
        storage.write(path, passThroughStreams[index], options),
      ),
    );

    // Log all errors and throw if all write operations fail
    let errorsCount = 0;
    writeResults.forEach((result, index) => {
      if (result.status === "rejected") {
        const storageId = this.storages[index].getId();
        logger.error(
          new OneOfStorageWriteOneFailedException(
            storageId,
            path,
            `Error writing to storage ${storageId}`,
            (result as PromiseRejectedResult).reason,
          ),
        );
        errorsCount++;
      }
    });
    if (errorsCount === this.storages.length) {
      throw new WriteFileException(path, `Write ${path} failed for all storages`);
    }

    const successResult = writeResults.filter(
      result => result.status === "fulfilled",
    )[0] as PromiseFulfilledResult<WriteMetadata>;
    return successResult.value;
  };

  /**
   * Reads a file from the primary storage. If it fails, attempts to read from other storages.
   * @param path - The path of the file to be read.
   * @param options
   * @returns A readable stream of the file.
   * @throws Error if all storage read attempts fail.
   */
  read = async (path: string, options?: ReadOptions): Promise<Readable> => {
    for (const storage of this.storages) {
      try {
        if (await storage.exists(path, options)) {
          return await storage.read(path, options);
        }
      } catch (err) {
        logger.error(
          new OneOfStorageReadOneFailedException(
            storage.getId(),
            path,
            `Reading ${path} from storage ${storage} failed.`,
            err,
          ),
        );
      }
    }
    throw new FileNotFountException(path, `Error reading ${path}`);
  };

  /**
   * Checks if a file exists in any of the configured storages.
   * @param path - The path of the file to check.
   * @param options
   * @returns A boolean indicating whether the file exists in any storage.
   */
  exists = async (path: string, options?: ReadOptions): Promise<boolean> => {
    for (const storage of this.storages) {
      try {
        if (await storage.exists(path, options)) {
          return true;
        }
      } catch (e) {
        throw new OneOfStorageReadOneFailedException(
          storage.getId(),
          path,
          `Reading ${path} from storage ${storage} failed.`,
          e,
        );
      }
    }
    return false;
  };

  /** If any of the storages fails, then fail. Otherwise return a union of all paths related to that file's path */
  async enumeratePathsForFile(filePath: string): Promise<string[]> {
    const paths = new Set<string>();
    // This needs all storages to respond. Until then, deletion must be retried, so fail.
    for (const storage of this.storages)
      for (const path of await storage.enumeratePathsForFile(filePath)) paths.add(path);
    return [...paths.values()];
  }

  /**
   * Removes a file from all configured storages.
   * @param path - The path of the file to be removed.
   * @param options
   */
  remove = async (path: string, options?: DeleteOptions): Promise<boolean> => {
    return Promise.all(this.storages.map(storage => storage.remove(path, options))).then(array => {
      return array.reduce((a, b) => a && b);
    });
  };
}

/**
 * Throw when read from one of the storages is filed.
 */
class StorageException extends Error {
  constructor(readonly storageId: string, readonly path: string, details: string, error: Error) {
    super(details, error);
  }
}

/**
 * Throw when read from one of the storages is filed.
 */
class OneOfStorageReadOneFailedException extends StorageException {}
/**
 * Thrown when write operation to one of the storages is failed.
 */
class OneOfStorageWriteOneFailedException extends StorageException {}
