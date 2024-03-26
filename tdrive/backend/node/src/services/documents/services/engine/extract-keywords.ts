import globalResolver from "../../../../services/global-resolver";
import { logger } from "../../../../core/platform/framework";
import { MessageQueueHandler } from "../../../../core/platform/services/message-queue/api";
import { DocumentsMessageQueueCallback, DocumentsMessageQueueRequest } from "../../types";
import { getKeywordsOfFile } from "../../utils";

export class DocumentsProcessor
  implements MessageQueueHandler<DocumentsMessageQueueRequest, DocumentsMessageQueueCallback>
{
  readonly name = "DocumentsProcessor";

  readonly topics = {
    in: "services:documents:process",
    out: "services:documents:process:callback",
  };

  readonly options = {
    unique: true,
    ack: true,
  };

  validate(message: DocumentsMessageQueueRequest): boolean {
    return !!(
      message &&
      message.context &&
      message.item &&
      message.item.id &&
      message.version &&
      message.version.file_metadata &&
      message.version.file_metadata.external_id &&
      !message.item.is_directory
    );
  }

  async process(message: DocumentsMessageQueueRequest): Promise<DocumentsMessageQueueCallback> {
    logger.info(`${this.name} - process document content keywords for ${message.item.id}`);

    return await this.generate(message);
  }

  async generate(message: DocumentsMessageQueueRequest): Promise<DocumentsMessageQueueCallback> {
    let content_keywords = "";
    try {
      const storedFile = await globalResolver.services.files.download(
        message.version.file_metadata.external_id,
        message.context,
      );
      content_keywords = await getKeywordsOfFile(storedFile.mime, storedFile.name, storedFile.file);
    } catch (error) {
      console.debug(error);
      logger.error({ error: `${error}` }, "Failed to generate content keywords");
    }
    return { content_keywords, item: message.item };
  }
}
