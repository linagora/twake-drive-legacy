import { Stream, Readable } from "stream";
import { TdriveServiceProvider } from "../../framework";
import { ExecutionContext } from "../../framework/api/crud-service";
import { IServiceDiagnosticProvider } from "../../framework/api/diagnostics";

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

export interface StorageConnectorAPI extends IServiceDiagnosticProvider {
  /**
   * Returns identifier of a storage that should've been set in configuration.
   *
   */
  getId(): string;

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

  /**
   * Enumerate all physical storage paths related to the provided file path
   */
  enumeratePathsForFile(filePath: string): Promise<string[]>;
}

export default interface StorageAPI extends TdriveServiceProvider, StorageConnectorAPI {
  getConnector(): StorageConnectorAPI;
  getConnectorType(): string;
  getHomeDir(): string;
}
