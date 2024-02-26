import { randomBytes } from "crypto";
import { Readable } from "stream";
import { Multipart } from "fastify-multipart";
import { UploadOptions } from "../types";
import { File } from "../entities/file";
import Repository from "../../../../src/core/platform/services/database/services/orm/repository/repository";
import { CompanyExecutionContext } from "../web/types";
import { logger } from "../../../core/platform/framework";
import { getDownloadRoute, getThumbnailRoute } from "../web/routes";
import {
  CrudException,
  DeleteResult,
  ExecutionContext,
} from "../../../core/platform/framework/api/crud-service";
import gr from "../../global-resolver";
import {
  PreviewClearMessageQueueRequest,
  PreviewMessageQueueRequest,
} from "../../../services/previews/types";
import { PreviewFinishedProcessor } from "./preview";
import _ from "lodash";

export class FileServiceImpl {
  version: "1";
  repository: Repository<File>;
  private algorithm = "aes-256-cbc";
  private max_preview_file_size = 50000000;

  async init(): Promise<this> {
    try {
      await Promise.all([(this.repository = await gr.database.getRepository<File>("files", File))]);
      gr.platformServices.messageQueue.processor.addHandler(
        new PreviewFinishedProcessor(this, this.repository),
      );
    } catch (err) {
      logger.error("Error while initializing files service", err);
    }
    return this;
  }

  async save(
    id: string,
    file: Multipart,
    options: UploadOptions,
    context: CompanyExecutionContext,
  ): Promise<File> {
    const userId = context.user?.id;
    const applicationId: string | null = context.user?.application_id || null;

    let entity: File = null;
    if (id) {
      entity = await this.repository.findOne(
        {
          company_id: context.company.id,
          id: id,
        },
        {},
        context,
      );
      if (!entity) {
        throw new Error(`This file ${id} does not exist`);
      }
    }

    if (!entity) {
      entity = new File();
      entity.company_id = `${context.company.id}`;
      entity.metadata = null;
      entity.thumbnails = [];

      const iv = randomBytes(8).toString("hex");
      const secret_key = randomBytes(16).toString("hex");
      entity.encryption_key = `${secret_key}.${iv}`;

      entity.user_id = userId;
      entity.application_id = applicationId;
      entity.upload_data = null;

      await this.repository.save(entity, context);
    }

    if (file) {
      // Detect a new file upload
      // Only applications can overwrite a file.
      // Users alone can only write an empty file.
      if (applicationId || !entity.upload_data?.size || context.user.server_request) {
        if (
          //If there was any change to the file
          entity.upload_data?.size !== options.totalSize ||
          entity.metadata?.name !== options.filename
        ) {
          entity.metadata = {
            name: options.filename,
            mime: options.type,
            thumbnails_status: "done",
          };
          entity.upload_data = {
            size: options.totalSize,
            chunks: options.totalChunks || 1,
          };
          await this.repository.save(entity, context);
        }
      }

      let totalUploadedSize = 0;
      file.file.on("data", function (chunk) {
        totalUploadedSize += chunk.length;
      });
      await gr.platformServices.storage.write(getFilePath(entity), file.file, {
        chunkNumber: options.chunkNumber,
        encryptionAlgo: this.algorithm,
        encryptionKey: entity.encryption_key,
      });

      if (entity.upload_data.chunks === 1 && totalUploadedSize) {
        entity.upload_data.size = totalUploadedSize;
        await this.repository.save(entity, context);

        /** Send preview generation task */
        if (entity.upload_data.size < this.max_preview_file_size) {
          const document: PreviewMessageQueueRequest["document"] = {
            id: JSON.stringify(_.pick(entity, "id", "company_id")),
            provider: gr.platformServices.storage.getConnectorType(),

            path: getFilePath(entity),
            encryption_algo: this.algorithm,
            encryption_key: entity.encryption_key,
            chunks: entity.upload_data.chunks,

            filename: entity.metadata.name,
            mime: entity.metadata.mime,
          };
          const output = {
            provider: gr.platformServices.storage.getConnectorType(),
            path: `${getFilePath(entity)}/thumbnails/`,
            encryption_algo: this.algorithm,
            encryption_key: entity.encryption_key,
            pages: 10,
          };

          entity.metadata.thumbnails_status = "waiting";
          await this.repository.save(entity, context);

          if (!options?.ignoreThumbnails) {
            try {
              await gr.platformServices.messageQueue.publish<PreviewMessageQueueRequest>(
                "services:preview",
                {
                  data: { document, output },
                },
              );

              if (options.waitForThumbnail) {
                entity = await gr.services.files.getFile(
                  {
                    id: entity.id,
                    company_id: context.company.id,
                  },
                  context,
                  { waitForThumbnail: true },
                );
              }
            } catch (err) {
              entity.metadata.thumbnails_status = "error";
              await this.repository.save(entity, context);

              logger.warn({ err }, "Previewing - Error while sending ");
            }
          }
        }
        /** End preview generation task generation */
      }
    }

    return await this.getFile({ id: entity.id, company_id: entity.company_id }, context, {
      waitForThumbnail: options.waitForThumbnail,
    });
  }

  async exists(id: string, companyId: string, context?: CompanyExecutionContext): Promise<boolean> {
    const entity = await this.getFile({ id, company_id: companyId }, context);
    return !!entity;
  }

  async download(
    id: string,
    context: CompanyExecutionContext,
  ): Promise<{ file: Readable; name: string; mime: string; size: number }> {
    const entity = await this.get(id, context);
    if (!entity) {
      throw "File not found";
    }

    const readable = await gr.platformServices.storage.read(getFilePath(entity), {
      totalChunks: entity.upload_data.chunks,
      encryptionAlgo: this.algorithm,
      encryptionKey: entity.encryption_key,
    });

    return {
      file: readable,
      name: entity.metadata.name,
      mime: entity.metadata.mime,
      size: entity.upload_data.size,
    };
  }

  async thumbnail(
    id: string,
    index: string,
    context: CompanyExecutionContext,
  ): Promise<{ file: Readable; type: string; size: number }> {
    const entity = await this.get(id, context);

    if (!entity) {
      throw "File not found";
    }

    const thumbnail = entity.thumbnails[parseInt(index)];
    if (!thumbnail) {
      throw `Thumbnail ${parseInt(index)} not found`;
    }

    const thumbnailPath = `${getFilePath(entity)}/thumbnails/${thumbnail.id}`;

    const readable = await gr.platformServices.storage.read(thumbnailPath, {
      encryptionAlgo: this.algorithm,
      encryptionKey: entity.encryption_key,
    });

    return {
      file: readable,
      type: thumbnail.type,
      size: thumbnail.size,
    };
  }

  get(id: string, context: CompanyExecutionContext): Promise<File> {
    if (!id || !context.company.id) {
      return null;
    }
    return this.getFile({ id, company_id: context.company.id }, context);
  }

  async getFile(
    pk: Pick<File, "company_id" | "id">,
    context?: ExecutionContext,
    options?: {
      waitForThumbnail?: boolean;
    },
  ): Promise<File> {
    let entity = await this.repository.findOne(pk, {}, context);
    if (entity == null) {
      throw new CrudException(`File not found ${pk.company_id}|${pk.id}`, 404);
    }

    if (options?.waitForThumbnail) {
      for (let i = 1; i < 100; i++) {
        if (entity.metadata.thumbnails_status === "done") {
          break;
        }
        await new Promise(r => setTimeout(r, i * 200));
        entity = await this.repository.findOne(pk, {}, context);
      }
    }

    return entity;
  }

  getThumbnailRoute(file: File, index: string) {
    return getThumbnailRoute(file, index);
  }

  getDownloadRoute(file: File) {
    return getDownloadRoute(file);
  }

  async delete(id: string, context: CompanyExecutionContext): Promise<DeleteResult<File>> {
    const fileToDelete = await this.get(id, context);

    if (!fileToDelete) {
      throw new CrudException("File not found", 404);
    }

    await this.repository.remove(fileToDelete, context);

    const path = getFilePath(fileToDelete);

    await gr.platformServices.storage.remove(path, {
      totalChunks: fileToDelete.upload_data.chunks,
    });

    if (fileToDelete.thumbnails.length > 0) {
      await gr.platformServices.messageQueue.publish<PreviewClearMessageQueueRequest>(
        "services:preview:clear",
        {
          data: {
            document: {
              id: JSON.stringify(_.pick(fileToDelete, "id", "company_id")),
              provider: gr.platformServices.storage.getConnectorType(),
              path: `${path}/thumbnails/`,
              thumbnails_number: fileToDelete.thumbnails.length,
            },
          },
        },
      );
    }

    return new DeleteResult("files", fileToDelete, true);
  }
}

function getFilePath(entity: File): string {
  return `/files/${entity.company_id}/${entity.user_id || "anonymous"}/${entity.id}`;
}
