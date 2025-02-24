import { createCipheriv, createDecipheriv, Decipher } from "crypto";
import { Stream, Readable } from "stream";
import Multistream from "multistream";
import {
  Consumes,
  logger,
  TdriveService,
  TdriveServiceConfiguration,
  TdriveServiceOptions,
} from "../../framework";
import LocalConnectorService, { LocalConfiguration } from "./connectors/local/service";
import S3ConnectorService, { S3Configuration } from "./connectors/S3/s3-service";
import StorageAPI, {
  DeleteOptions,
  ReadOptions,
  StorageConnectorAPI,
  WriteMetadata,
  WriteOptions,
} from "./provider";

import { OneOfStorageStrategy } from "./oneof-storage-strategy";
import { DefaultStorageStrategy } from "./default-storage-strategy";
import { FileNotFountException } from "./exceptions";

type EncryptionConfiguration = {
  secret: string | null;
  iv: string | null;
};
@Consumes([])
export default class StorageService extends TdriveService<StorageAPI> implements StorageAPI {
  name = "storage";
  version = "1";

  private encryptionOptions: EncryptionConfiguration;
  private algorithm = "aes-256-cbc";
  private connector: StorageConnectorAPI;
  /**
   * It's important for the S3 storage not to start home directory with a trailing slash.
   * But for the local storage it's a default value
   * @private
   */
  private homeDir = "tdrive";

  constructor(protected options?: TdriveServiceOptions<TdriveServiceConfiguration>) {
    super(options);
    //init home directory variable
    this.initHomeDirectory();
    //init connector to storage
    this.getConnector();
  }

  api(): StorageAPI {
    return this;
  }

  getConnectorType(): string {
    return this.configuration.get<string>("type");
  }

  getConnector(): StorageConnectorAPI {
    if (!this.connector) {
      this.connector = this.getStorageStrategy();
    }
    return this.connector;
  }

  getDiagnostics(depth) {
    return this.getConnector().getDiagnostics(depth);
  }

  getHomeDir(): string {
    return this.homeDir;
  }

  exists(path: string, options?: ReadOptions): Promise<boolean> {
    //TODO[ASH] check for all the file chunks
    return this.getConnector().exists(path + "/chunk1", options);
  }

  enumeratePathsForFile(filePath: string): Promise<string[]> {
    return this.getConnector().enumeratePathsForFile(filePath);
  }

  async write(path: string, stream: Stream, options?: WriteOptions): Promise<WriteMetadata> {
    try {
      if (options?.encryptionKey) {
        const [key, iv] = options.encryptionKey.split(".");
        const cipher = createCipheriv(options.encryptionAlgo || this.algorithm, key, iv);
        stream = stream.pipe(cipher);
      }
      if (options?.chunkNumber) path = `${path}/chunk${options.chunkNumber}`;

      if (this.encryptionOptions.secret) {
        try {
          const cipher = createCipheriv(
            this.algorithm,
            this.encryptionOptions.secret,
            this.encryptionOptions.iv,
          );
          stream = stream.pipe(cipher);
        } catch (err) {
          logger.error("Unable to createCipheriv: %s", err);
        }
      }

      return await this.getConnector().write(path, stream);
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  async read(path: string, options?: ReadOptions): Promise<Readable> {
    if (!(await this.exists(path, options))) {
      throw new FileNotFountException(path, "File doesn't exist");
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      const chunks = options?.totalChunks || 1;
      let count = 1;

      async function factory(callback: (err?: Error, stream?: Stream) => unknown) {
        if (count > chunks) {
          callback();
          return;
        }

        let decipher: Decipher | undefined;
        if (options?.encryptionKey) {
          const [key, iv] = options.encryptionKey.split(".");
          decipher = createDecipheriv(options.encryptionAlgo || this.algorithm, key, iv);
        }

        const chunk = options?.totalChunks ? `${path}/chunk${count}` : path;
        count += 1;

        try {
          let stream = await self._read(chunk); // Read the chunk
          if (decipher) {
            stream = stream.pipe(decipher); // Apply decipher if necessary
          }
          callback(null, stream); // Return the stream only once
        } catch (err) {
          logger.error(err);
          callback(err, null);
        }
      }

      return new Multistream(factory);
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  async _read(path: string): Promise<Readable> {
    let stream = await this.getConnector().read(path);
    if (this.encryptionOptions.secret) {
      try {
        const decipher = createDecipheriv(
          this.algorithm,
          this.encryptionOptions.secret,
          this.encryptionOptions.iv,
        );
        stream = stream.pipe(decipher);
      } catch (err) {
        logger.error("Unable to createDecipheriv: %s", err);
        throw err;
      }
    }
    return stream;
  }

  async remove(path: string, options?: DeleteOptions) {
    try {
      for (let count = 1; count <= (options?.totalChunks || 1); count++) {
        const chunk = options?.totalChunks ? `${path}/chunk${count}` : path;
        await this.getConnector().remove(chunk);
      }
      return true;
    } catch (err) {
      logger.error("Unable to remove file %s", err);
    }
    return false;
  }

  async doInit(): Promise<this> {
    this.encryptionOptions = {
      secret: this.configuration.get<string>("secret", null),
      iv: this.configuration.get<string>("iv", null),
    };

    return this;
  }

  /**
   * Instantiates storage strategy with configuration.
   * "storage": {
   *     "secret": "",
   *     "iv": "",
   *     "strategy": "oneof",
   *     "type": "local",
   *     "S3": {
   *       "endPoint": "play.min.io",
   *       "port": 9000,
   *       "useSSL": false,
   *       "accessKey": "ABCD",
   *       "secretKey": "x1yz",
   *       "disableRemove": false
   *     },
   *     "local": {
   *       "path": "/tdrive"
   *     },
   *     "oneof": [
   *       {
   *         "type": "S3",
   *         "S3": {}
   *       },
   *       {
   *         "type": "local",
   *         "local": {}
   *     }]
   *   },
   */
  getStorageStrategy(): StorageConnectorAPI {
    const strategy = this.configuration.get<string>("strategy");
    if (strategy == "oneof") {
      logger.info("Creating storage with 'oneof' strategy");
      const connectors = this.configuration
        .get<Array<StorageConfiguration>>("oneof")
        .map(c => this.createConnector(c));
      return new OneOfStorageStrategy(connectors);
    } else {
      logger.info("Creating storage with 'default' strategy");
      return new DefaultStorageStrategy(this.createConnectorFromConfiguration(this.configuration));
    }
  }

  createConnector(config: StorageConfiguration) {
    const type = config.type;
    if (type === "S3") {
      return this.newS3Connector(config.S3);
    } else {
      return this.newLocalConnector(config.local, type);
    }
  }

  createConnectorFromConfiguration(config: TdriveServiceConfiguration) {
    const type = config.get<string>("type");
    if (type === "S3") {
      return this.newS3Connector(config.get("S3"));
    } else {
      return this.newLocalConnector(this.configuration.get<LocalConfiguration>("local"), type);
    }
  }

  newS3Connector(config: S3Configuration) {
    logger.info("Using 'S3' connector for storage.");
    return new S3ConnectorService(config);
  }

  newLocalConnector(config: LocalConfiguration, type: string) {
    logger.info(
      `Using 'local' connector for storage${
        type === "local" ? "" : " (no other connector recognized from configuration type: '%s')"
      }.`,
      type,
    );
    logger.trace(`Home directory for the storage: ${this.homeDir}`);
    return new LocalConnectorService(config);
  }

  initHomeDirectory() {
    const type = this.getConnectorType();
    if (type === "S3") {
      logger.info("Using 'S3' connector for storage.");
      try {
        this.homeDir = this.configuration.get<string>("S3.homeDirectory");
      } catch (e) {
        this.logger.warn("Home directory is not set, using S3.bucket instead");
      }
      if (!this.homeDir) {
        this.homeDir = this.configuration.get<string>("S3.bucket");
      }
      if (this.homeDir && this.homeDir.startsWith("/")) {
        this.logger.error("For S3 connector home directory MUST NOT start with '/'");
        throw new Error("For S3 connector home directory MUST NOT start with '/'");
      }
    } else {
      this.logger.info("For 'local' connector setting home directory to '/tdrive'");
      this.homeDir = "/tdrive";
    }
  }

  getId() {
    return this.connector.getId();
  }
}

type StorageConfiguration = {
  type: string;
  S3?: S3Configuration;
  local?: LocalConfiguration;
};
