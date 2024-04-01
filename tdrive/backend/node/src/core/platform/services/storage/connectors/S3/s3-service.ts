import * as Minio from "minio";
import { logger } from "../../../../../../core/platform/framework";
import { Readable } from "stream";
import { StorageConnectorAPI, WriteMetadata } from "../../provider";

export type S3Configuration = {
  bucket: string;
  region: string;
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  disableRemove: boolean;
};

export default class S3ConnectorService implements StorageConnectorAPI {
  client: Minio.Client;
  minioConfiguration: S3Configuration;

  constructor(S3Configuration: S3Configuration) {
    this.client = new Minio.Client(S3Configuration);
    this.minioConfiguration = S3Configuration;
  }

  write(path: string, stream: Readable): Promise<WriteMetadata> {
    return new Promise((resolve, reject) => {
      let totalSize = 0;
      let didCompletePutObject = false;
      let didCompleteCalculateSize = false;
      const doResolve = () =>
        didCompletePutObject &&
        didCompleteCalculateSize &&
        resolve({
          size: totalSize,
        });
      stream
        .on("data", function (chunk) {
          totalSize += chunk.length;
        })
        .on("end", () => {
          // TODO: this could be bad practice as it puts the stream in flow mode before putObject gets to it
          didCompleteCalculateSize = true;
          doResolve();
        });
      this.client
        .putObject(this.minioConfiguration.bucket, path, stream)
        .then(_x => {
          didCompletePutObject = true;
          doResolve();
        })
        .catch(reject);
    });
  }

  async read(path: string): Promise<Readable> {
    // Test if file exists in S3 bucket 10 times until we find it
    const tries = 10;
    let err = null;
    for (let i = 0; i <= tries; i++) {
      try {
        const stat = await this.client.statObject(this.minioConfiguration.bucket, path);
        if (stat?.size > 0) {
          break;
        }
      } catch (e) {
        err = e;
      }

      if (i === tries) {
        logger.info(`Unable to get file after ${tries} tries:`);
        throw err;
      }

      await new Promise(r => setTimeout(r, 500));
      logger.info(`File ${path} not found in S3 bucket, retrying...`);
    }
    return this.client.getObject(this.minioConfiguration.bucket, path);
  }

  async remove(path: string): Promise<boolean> {
    try {
      if (this.minioConfiguration.disableRemove) {
        logger.info(`File ${path} wasn't removed, file removal is disabled in configuration`);
        return true;
      } else {
        await this.client.removeObject(this.minioConfiguration.bucket, path);
        return true;
      }
    } catch (err) {}
    return false;
  }

  async exists(path: string): Promise<boolean> {
    logger.trace(`Reading file ... ${path}`);
    const tries = 2;
    for (let i = 0; i <= tries; i++) {
      try {
        const stat = await this.client.statObject(this.minioConfiguration.bucket, path);
        if (stat?.size > 0) {
          break;
        }
      } catch (e) {
        logger.error("Error getting information from S3", e);
      }

      if (i === tries) {
        logger.info(`Unable to get file after ${tries} tries:`);
        return false;
      }
      await new Promise(r => setTimeout(r, 500));
      logger.info(`File ${path} not found in S3 bucket, retrying...`);
    }
    return true;
  }
}
