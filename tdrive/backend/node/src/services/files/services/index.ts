import { randomBytes } from "crypto";
import { Readable } from "stream";
import { MultipartFile } from "@fastify/multipart";
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
  ListResult,
  Pagination,
} from "../../../core/platform/framework/api/crud-service";
import gr from "../../global-resolver";
import {
  PreviewClearMessageQueueRequest,
  PreviewMessageQueueRequest,
} from "../../../services/previews/types";
import { PreviewFinishedProcessor } from "./preview";
import _, { isNull, isUndefined } from "lodash";
import User from "../../user/entities/user";
import { DriveFile } from "../../documents/entities/drive-file";
import { MissedDriveFile } from "../../documents/entities/missed-drive-file";
import { FileVersion } from "../../documents/entities/file-version";
import { getPath } from "../../documents/utils";

export class FileServiceImpl {
  version: "1";
  repository: Repository<File>;
  userRepository: Repository<User>;
  documentRepository: Repository<DriveFile>;
  missedFileRepository: Repository<MissedDriveFile>;
  versionRepository: Repository<FileVersion>;
  private algorithm = "aes-256-cbc";
  private max_preview_file_size = 50000000;
  private checkConsistencyInProgress = false;

  async init(): Promise<this> {
    try {
      await Promise.all([(this.repository = await gr.database.getRepository<File>("files", File))]);
      await Promise.all([
        (this.userRepository = await gr.database.getRepository<User>("user", User)),
      ]);
      await Promise.all([
        (this.documentRepository = await gr.database.getRepository<DriveFile>(
          "drive_files",
          DriveFile,
        )),
      ]);
      await Promise.all([
        (this.missedFileRepository = await gr.database.getRepository<MissedDriveFile>(
          "missed_drive_files",
          MissedDriveFile,
        )),
      ]);
      await Promise.all([
        (this.versionRepository = await gr.database.getRepository<FileVersion>(
          "drive_file_versions",
          FileVersion,
        )),
      ]);
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
    file: MultipartFile,
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

  async checkConsistency(): Promise<any> {
    const ver = new Date().getTime();
    const data = [];
    if (!this.checkConsistencyInProgress) {
      this.checkConsistencyInProgress = true;
      let result: ListResult<FileVersion>;
      let page: Pagination = { limitStr: "20" };
      try {
        do {
          result = await this.versionRepository.find({}, { pagination: page });
          //check that the file exists
          const jobs: Promise<void>[] = [];
          for (const version of result.getEntities()) {
            if (version.file_metadata.external_id) {
              const checkFile = async () => {
                try {
                  const file = await this.getFile({
                    id: version.file_metadata.external_id,
                    company_id: "00000000-0000-4000-0000-000000000000",
                  });
                  const exist = await gr.platformServices.storage.exists(
                    getFilePath(file) + "/chunk1",
                  );
                  if (exist) {
                    logger.info(`File ${version.file_metadata.external_id} exists in S3`);
                  } else {
                    logger.info(`File ${version.file_metadata.external_id} DOES NOT exists in S3`);
                    const doc = await this.documentRepository.findOne({
                      id: version.drive_item_id,
                      company_id: "00000000-0000-4000-0000-000000000000",
                    });
                    let user = await this.userRepository.findOne({ id: doc.creator });
                    const isFromNextcloud = isUndefined(user) || isNull(user);
                    const path = await getPath(doc.id, this.documentRepository, true, {
                      company: { id: "00000000-0000-4000-0000-000000000000" },
                    } as CompanyExecutionContext);
                    if (isFromNextcloud) {
                      if (path[0].id.startsWith("user_")) {
                        user = await this.userRepository.findOne({ id: path[0].id.substring(5) });
                      }
                    }
                    const missedFile = new MissedDriveFile();
                    Object.assign(missedFile, {
                      id: version.file_metadata.external_id,
                      added: doc.added,
                      doc_id: doc.id,
                      file_id: version.file_metadata.external_id,
                      creator: user?.id,
                      name: doc.name,
                      is_in_trash: doc.is_in_trash,
                      user_email: user?.email_canonical,
                      is_from_nextcloud: isFromNextcloud,
                      path: path.map(e => e?.name).join("/"),
                      size: doc.size,
                      version: ver,
                    });
                    await this.missedFileRepository.save(missedFile);
                    logger.info(`Missing file:: ${JSON.stringify(missedFile)}`);
                  }
                } catch (e) {
                  logger.warn(`Can't find ${version.file_metadata.external_id} in DB`);
                }
              };
              jobs.push(checkFile.bind(this)());
            }
          }
          await Promise.all(jobs);
          //go to next page
          page = Pagination.fromPaginable(result.nextPage);
        } while (page.page_token);
      } finally {
        this.checkConsistencyInProgress = false;
        logger.info("Scanning for missing file finished.");
      }
    }
    return data;
  }

  async checkFileExistsS3(id: string): Promise<any> {
    try {
      const doc = await this.documentRepository.findOne({
        id,
        company_id: "00000000-0000-4000-0000-000000000000",
      });
      const externalId = doc.last_version_cache.file_metadata.external_id;
      const file = await this.getFile({
        id: externalId,
        company_id: "00000000-0000-4000-0000-000000000000",
      });
      const exist = await gr.platformServices.storage.exists(getFilePath(file) + "/chunk1");
      if (exist) {
        return { exist: true, file };
      } else {
        return { exist: false, file };
      }
    } catch (error) {
      logger.error(`Error while checking file ${id} in S3`, error);
      return { exist: false, file: null };
    }
  }

  async restoreFileS3(id: string, file: MultipartFile, options: UploadOptions): Promise<any> {
    try {
      const result = await this.checkFileExistsS3(id);
      if (result.exist) {
        return { success: true };
      }
      await gr.platformServices.storage.write(getFilePath(result.file), file.file, {
        chunkNumber: options.chunkNumber,
        encryptionAlgo: this.algorithm,
        encryptionKey: result.file.encryption_key,
      });
      return { success: true };
    } catch (error) {
      logger.error(`Error while uploading missing file ${id} to S3`, error);
      return { success: false };
    }
  }
}
export const getFilePath = (entity: File): string => {
  return `${gr.platformServices.storage.getHomeDir()}/files/${entity.company_id}/${
    entity.user_id || "anonymous"
  }/${entity.id}`;
};
