import { Readable, Stream } from "stream";
import { ExecutionContext } from "../../framework/api/crud-service";
import {
  DeleteOptions,
  ReadOptions,
  StorageConnectorAPI,
  WriteMetadata,
  WriteOptions,
} from "../storage/provider";

export class DefaultStorageStrategy implements StorageConnectorAPI {
  private connector: StorageConnectorAPI;

  constructor(connector: StorageConnectorAPI) {
    this.connector = connector;
  }

  write = (
    path: string,
    stream: Stream,
    options?: WriteOptions,
    context?: ExecutionContext,
  ): Promise<WriteMetadata> => {
    return this.connector.write(path, stream, options, context);
  };

  read = (path: string, options?: ReadOptions, context?: ExecutionContext): Promise<Readable> => {
    return this.connector.read(path, options, context);
  };

  exists = (path: string, options?: ReadOptions, context?: ExecutionContext): Promise<boolean> => {
    return this.connector.exists(path, options, context);
  };

  remove = (
    path: string,
    options?: DeleteOptions,
    context?: ExecutionContext,
  ): Promise<boolean> => {
    return this.connector.remove(path, options, context);
  };
}
