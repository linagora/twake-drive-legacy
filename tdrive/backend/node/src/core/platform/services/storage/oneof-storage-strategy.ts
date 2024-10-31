import { Readable, Stream, PassThrough } from "stream";
import {
  DeleteOptions,
  ReadOptions,
  StorageConnectorAPI,
  WriteMetadata,
  WriteOptions,
} from "../storage/provider";
import { logger } from "../../../platform/framework";

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
  constructor(private readonly storages: StorageConnectorAPI[]) {}

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
      logger.error("Error in input stream, destroying all write streams:", err);
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
      this.storages.map(
        (storage, index) => storage.write(path, passThroughStreams[index]),
        options,
      ),
    );

    // Log all errors and throw if all write operations fail
    const errors = writeResults.filter(result => result.status === "rejected");
    errors.forEach((error, index) => {
      logger.error(`Error writing to storage ${index}:`, (error as PromiseRejectedResult).reason);
    });
    if (errors.length === this.storages.length) {
      throw new Error("Write operation failed for all storages");
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
        logger.error("Fallback storage read failed:", err);
      }
    }
    throw new Error(`Error reading ${path} in all the storages.`);
  };

  /**
   * Checks if a file exists in any of the configured storages.
   * @param path - The path of the file to check.
   * @param options
   * @returns A boolean indicating whether the file exists in any storage.
   */
  exists = async (path: string, options?: ReadOptions): Promise<boolean> => {
    for (const storage of this.storages) {
      if (await storage.exists(path, options)) {
        return true;
      }
    }
    return false;
  };

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
