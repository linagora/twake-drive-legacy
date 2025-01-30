import fs, { promises as fsPromise } from "fs";
import { logger } from "../../../../../core/platform/framework";
import {
  PreviewMessageQueueCallback,
  PreviewMessageQueueRequest,
  ThumbnailResult,
} from "../../../types";
import gr from "../../../../global-resolver";
import { MessageQueueHandler } from "../../../../../core/platform/services/message-queue/api";
import { getTmpFile } from "../../../../../utils/files";

const { unlink } = fsPromise;
/**
 * Generate thumbnails when the upload is finished
 */
export class PreviewProcessor
  implements MessageQueueHandler<PreviewMessageQueueRequest, PreviewMessageQueueCallback>
{
  readonly name = "PreviewProcessor";

  init?(): Promise<this> {
    throw new Error("Method not implemented.");
  }

  readonly topics = {
    in: "services:preview",
    out: "services:preview:callback",
  };

  readonly options = {
    unique: true,
    ack: true,
  };

  validate(message: PreviewMessageQueueRequest): boolean {
    return !!(message && message.document && message.output);
  }

  async process(message: PreviewMessageQueueRequest): Promise<PreviewMessageQueueCallback> {
    logger.info(`${this.name} - Processing preview generation ${message.document.id}`);

    let res: PreviewMessageQueueCallback = { document: message.document, thumbnails: [] };
    try {
      res = await this.generate(message);
    } catch (err) {
      logger.error(`${this.name} - Can't generate thumbnails ${err}`);
    }

    logger.info(
      `${this.name} - Generated ${res.thumbnails.length} thumbnails from ${
        message.document.filename || message.document.id
      }`,
    );

    return res;
  }

  async generate(message: PreviewMessageQueueRequest): Promise<PreviewMessageQueueCallback> {
    //Download original file
    const readable = await gr.platformServices.storage.read(message.document.path, {
      totalChunks: message.document.chunks,
      encryptionAlgo: message.document.encryption_algo,
      encryptionKey: message.document.encryption_key,
    });
    if (!readable) {
      return { document: message.document, thumbnails: [] };
    }

    const inputPath = getTmpFile();
    const writable = fs.createWriteStream(inputPath);

    readable.pipe(writable);

    await new Promise<void>(r => {
      writable.on("finish", r);
    });

    writable.end();

    //Generate previews
    let localThumbnails: ThumbnailResult[] = [];

    try {
      localThumbnails = await gr.services.preview.files.generateThumbnails(
        { path: inputPath, mime: message.document.mime, filename: message.document.filename },
        message.output,
      );
    } catch (err) {
      logger.error(`${this.name} - Can't generate thumbnails ${err}`);
      localThumbnails = [];
      throw Error("Can't generate thumbnails.");
    }

    const thumbnails: PreviewMessageQueueCallback["thumbnails"] = [];

    for (let i = 0; i < localThumbnails.length; i++) {
      const uploadThumbnailPath = `${message.output.path.replace(/\/$/, "")}/${i}.png`;
      const uploadThumbnail = fs.createReadStream(localThumbnails[i].path);

      await gr.platformServices.storage.write(uploadThumbnailPath, uploadThumbnail, {
        encryptionAlgo: message.output.encryption_algo,
        encryptionKey: message.output.encryption_key,
      });

      thumbnails.push({
        path: uploadThumbnailPath,
        size: localThumbnails[i].size,
        type: localThumbnails[i].type,
        width: localThumbnails[i].width,
        height: localThumbnails[i].height,
      });

      await unlink(localThumbnails[i].path);
    }

    return { document: message.document, thumbnails };
  }
}
