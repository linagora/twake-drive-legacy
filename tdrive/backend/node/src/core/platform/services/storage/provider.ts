import { Stream, Readable } from "stream";
import { TdriveServiceProvider } from "../../framework";
import { ExecutionContext } from "../../framework/api/crud-service";

export type WriteMetadata = {
  size: number;
};

export type WriteOptions = {
  chunkNumber?: number;
  encryptionKey?: string;
  encryptionAlgo?: string;
};

export type ReadOptions = {
  totalChunks?: number;
  encryptionKey?: string;
  encryptionAlgo?: string;
};

export type DeleteOptions = {
  totalChunks?: number;
};

export interface StorageConnectorAPI {
  /**
   * Write a stream to a path
   *
   * @param path
   * @param stream
   */
  write(
    path: string,
    stream: Stream,
    options?: WriteOptions,
    context?: ExecutionContext,
  ): Promise<WriteMetadata>;

  /**
   * Read a path and returns its stream
   *
   * @param path
   */
  read(path: string, options?: ReadOptions, context?: ExecutionContext): Promise<Readable>;

  /**
   * Check that the file is exists
   *
   * @param path
   */
  exists(path: string, options?: ReadOptions, context?: ExecutionContext): Promise<boolean>;

  /**
   * Remove a path
   *
   * @param path
   */
  remove(path: string, options?: DeleteOptions, context?: ExecutionContext): Promise<boolean>;
}

export default interface StorageAPI extends TdriveServiceProvider, StorageConnectorAPI {
  getConnector(): StorageConnectorAPI;
  getConnectorType(): string;
  getHomeDir(): string;
}
