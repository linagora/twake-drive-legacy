import SearchRepository from "../../../core/platform/services/search/repository";
import { getLogger, logger, TdriveLogger } from "../../../core/platform/framework";
import {
  CrudException,
  ExecutionContext,
  ListResult,
} from "../../../core/platform/framework/api/crud-service";
import Repository, {
  comparisonType,
  inType,
} from "../../../core/platform/services/database/services/orm/repository/repository";
import { PublicFile } from "../../../services/files/entities/file";
import globalResolver from "../../../services/global-resolver";
import { hasCompanyAdminLevel } from "../../../utils/company";
import gr from "../../global-resolver";
import { DriveFile, TYPE } from "../entities/drive-file";
import { FileVersion, TYPE as FileVersionType } from "../entities/file-version";
import {
  DriveTdriveTab as DriveTdriveTabEntity,
  TYPE as DriveTdriveTabRepoType,
} from "../entities/drive-tdrive-tab";
import {
  BrowseDetails,
  CompanyExecutionContext,
  DocumentsMessageQueueRequest,
  DriveExecutionContext,
  DriveFileAccessLevel,
  DriveItemDetails,
  DriveTdriveTab,
  RootType,
  SearchDocumentsOptions,
  TrashType,
} from "../types";
import {
  addDriveItemToArchive,
  calculateItemSize,
  canMoveItem,
  getDefaultDriveItem,
  getDefaultDriveItemVersion,
  getFileMetadata,
  getItemName,
  getPath,
  getVirtualFoldersNames,
  isSharedWithMeFolder,
  isVirtualFolder,
  updateItemSize,
  isInTrash,
} from "../utils";
import {
  checkAccess,
  getAccessLevel,
  hasAccessLevel,
  makeStandaloneAccessLevel,
  getItemScope,
} from "./access-check";
import { websocketEventBus } from "../../../core/platform/services/realtime/bus";
import archiver from "archiver";
import internal from "stream";
import {
  RealtimeEntityActionType,
  ResourcePath,
} from "../../../core/platform/services/realtime/types";

export class DocumentsService {
  version: "1";
  repository: Repository<DriveFile>;
  searchRepository: SearchRepository<DriveFile>;
  fileVersionRepository: Repository<FileVersion>;
  driveTdriveTabRepository: Repository<DriveTdriveTabEntity>;
  ROOT: RootType = "root";
  TRASH: TrashType = "trash";
  logger: TdriveLogger = getLogger("Documents Service");

  async init(): Promise<this> {
    try {
      this.repository = await globalResolver.database.getRepository<DriveFile>(TYPE, DriveFile);
      this.searchRepository = globalResolver.platformServices.search.getRepository<DriveFile>(
        TYPE,
        DriveFile,
      );
      this.fileVersionRepository = await globalResolver.database.getRepository<FileVersion>(
        FileVersionType,
        FileVersion,
      );
      this.driveTdriveTabRepository =
        await globalResolver.database.getRepository<DriveTdriveTabEntity>(
          DriveTdriveTabRepoType,
          DriveTdriveTabEntity,
        );
    } catch (error) {
      logger.error({ error: `${error}` }, "Error while initializing Documents Service");
    }

    return this;
  }

  browse = async (
    id: string,
    options: SearchDocumentsOptions,
    context: DriveExecutionContext & { public_token?: string },
  ): Promise<BrowseDetails> => {
    if (isSharedWithMeFolder(id)) {
      const children = await this.search(options, context);
      return {
        access: "read",
        children: children.getEntities(),
        nextPage: children.nextPage,
        path: [] as Array<DriveFile>,
      };
    } else {
      return {
        nextPage: null,
        ...(await this.get(id, context)),
      };
    }
  };

  userQuota = async (context: CompanyExecutionContext): Promise<number> => {
    const children = await this.repository.find({
      parent_id: "user_" + context.user.id,
      company_id: context.company.id,
    });
    return children.getEntities().reduce((sum, child) => sum + child.size, 0);
  };

  /**
   * Fetches a drive element
   *
   * @param {string} id - the id of the DriveFile to fetch or "trash" or an empty string for root folder.
   * @param {DriveExecutionContext} context
   * @returns {Promise<DriveItemDetails>}
   */
  get = async (
    id: string,
    context: DriveExecutionContext & { public_token?: string },
  ): Promise<DriveItemDetails> => {
    if (!context) {
      this.logger.error("invalid context");
      return null;
    }

    id = id || this.ROOT;

    //Get requested entity
    const entity = isVirtualFolder(id)
      ? null
      : await this.repository.findOne(
          {
            company_id: context.company.id,
            id,
          },
          {},
          context,
        );

    if (!entity && !isVirtualFolder(id)) {
      this.logger.error("Drive item not found");
      throw new CrudException("Item not found", 404);
    }

    //Check access to entity
    try {
      const hasAccess = await checkAccess(id, entity, "read", this.repository, context);
      if (!hasAccess) {
        this.logger.error("user does not have access drive item " + id);
        throw Error("user does not have access to this item");
      }
    } catch (error) {
      this.logger.error({ error: `${error}` }, "Failed to grant access to the drive item");
      throw new CrudException("User does not have access to this item or its children", 401);
    }

    const isDirectory = entity ? entity.is_directory : true;

    //Get entity version in case of a file
    const versions = isDirectory
      ? []
      : (
          await this.fileVersionRepository.find(
            {
              drive_item_id: entity.id,
            },
            {},
            context,
          )
        ).getEntities();

    //Get children if it is a directory
    let children = isDirectory
      ? (
          await this.repository.find(
            {
              company_id: context.company.id,
              ...(id.includes(this.TRASH)
                ? {
                    is_in_trash: true,
                    ...(id == this.TRASH
                      ? {
                          scope: "shared",
                        }
                      : {
                          scope: "personal",
                          creator: context?.user?.id,
                        }),
                  }
                : {
                    parent_id: id,
                    is_in_trash: false,
                  }),
            },
            {},
            context,
          )
        ).getEntities()
      : [];

    //Check each children for access
    const accessMap: { [key: string]: boolean } = {};
    await Promise.all(
      children.map(async child => {
        accessMap[child.id] = await checkAccess(child.id, child, "read", this.repository, context);
      }),
    );
    children = children.filter(child => accessMap[child.id]);

    //Return complete object
    return {
      path: await getPath(id, this.repository, false, context),
      item:
        entity ||
        ({
          id,
          parent_id: null,
          name: await getVirtualFoldersNames(id, context),
          size: await calculateItemSize(
            { id, is_directory: true, size: 0 },
            this.repository,
            context,
          ),
        } as DriveFile),
      versions: versions,
      children: children,
      access: await getAccessLevel(id, entity, this.repository, context),
    };
  };

  getAccess = async (
    id: string,
    userId: string,
    context: DriveExecutionContext,
  ): Promise<DriveFileAccessLevel | "none" | null> => {
    if (!context) {
      this.logger.error("invalid context");
      return null;
    }

    id = id || this.ROOT;

    //Get requested entity
    const myAccessLevel = await getAccessLevel(id, null, this.repository, context);

    if (myAccessLevel !== "none") {
      return await getAccessLevel(id, null, this.repository, { ...context, user: { id: userId } });
    }

    return null;
  };

  /**
   * Creates a DriveFile item.
   *
   * @param {PublicFile} file - the multipart file
   * @param {Partial<DriveFile>} content - the DriveFile item to create
   * @param {Partial<FileVersion>} version - the DriveFile version.
   * @param {DriveExecutionContext} context - the company execution context.
   * @returns {Promise<DriveFile>} - the created DriveFile
   */
  create = async (
    file: PublicFile | null,
    content: Partial<DriveFile>,
    version: Partial<FileVersion>,
    context: DriveExecutionContext,
  ): Promise<DriveFile> => {
    try {
      const driveItem = getDefaultDriveItem(content, context);
      const driveItemVersion = getDefaultDriveItemVersion(version, context);
      driveItem.scope = await getItemScope(driveItem, this.repository, context);

      const hasAccess = await checkAccess(
        driveItem.parent_id,
        null,
        "write",
        this.repository,
        context,
      );
      if (!hasAccess) {
        this.logger.error("User does not have access to parent drive item", driveItem.parent_id);
        throw Error("User does not have access to this item parent");
      }

      if (file || driveItem.is_directory === false) {
        let fileToProcess;

        if (file) {
          fileToProcess = file;
        } else if (driveItemVersion.file_metadata.external_id) {
          fileToProcess = await globalResolver.services.files.getFile(
            {
              id: driveItemVersion.file_metadata.external_id,
              company_id: driveItem.company_id,
            },
            context,
            { waitForThumbnail: true },
          );
        }

        if (fileToProcess) {
          driveItem.size = fileToProcess.upload_data.size;
          driveItem.is_directory = false;
          driveItem.extension = fileToProcess.metadata.name.split(".").pop();
          driveItemVersion.filename = driveItemVersion.filename || fileToProcess.metadata.name;
          driveItemVersion.file_size = fileToProcess.upload_data.size;
          driveItemVersion.file_metadata.external_id = fileToProcess.id;
          driveItemVersion.file_metadata.mime = fileToProcess.metadata.mime;
          driveItemVersion.file_metadata.size = fileToProcess.upload_data.size;
          driveItemVersion.file_metadata.name = fileToProcess.metadata.name;
          driveItemVersion.file_metadata.thumbnails = fileToProcess.thumbnails;
          if (context.user.application_id) {
            driveItemVersion.application_id = context.user.application_id;
          }
        }
      }

      driveItem.name = await getItemName(
        driveItem.parent_id,
        driveItem.id,
        driveItem.name,
        driveItem.is_directory,
        this.repository,
        context,
      );
      // TODO: notify the user a document has been added to the directory shared with them
      try {
        if (driveItem.parent_id !== "root" && driveItem.parent_id !== "trash") {
          const parentItem = await this.repository.findOne(
            {
              id: driveItem.parent_id,
              company_id: context.company.id,
            },
            {},
            context,
          );
          const sharedWith = parentItem?.access_info
            ? parentItem.access_info.entities.filter(
                info => info.type === "user" && info.id !== context.user.id,
              )
            : [];

          if (sharedWith.length > 0) {
            // Notify the user that the document has been shared with them
            this.logger.info("Notifying users that the document has been shared with them: ", {
              sharedWith,
            });
            for (const info of sharedWith) {
              gr.services.documents.engine.notifyDocumentShared({
                context,
                item: driveItem,
                notificationEmitter: context.user.id,
                notificationReceiver: info.id,
              });
            }
          }
        }
      } catch (error) {
        console.error("🚀🚀 error:", error);
      }

      await this.repository.save(driveItem);
      driveItemVersion.drive_item_id = driveItem.id;

      await this.fileVersionRepository.save(driveItemVersion);
      driveItem.last_version_cache = driveItemVersion;

      await this.repository.save(driveItem);

      //TODO[ASH] update item size only for files, there is not need to do during direcotry creation
      await updateItemSize(driveItem.parent_id, this.repository, context);

      //TODO[ASH] there is no need to notify websocket, until we implement user notification
      await this.notifyWebsocket(driveItem.parent_id, context);

      await globalResolver.platformServices.messageQueue.publish<DocumentsMessageQueueRequest>(
        "services:documents:process",
        {
          data: {
            item: driveItem,
            version: driveItemVersion,
            context,
          },
        },
      );

      return driveItem;
    } catch (error) {
      this.logger.error({ error: `${error}` }, "Failed to create drive item");
      CrudException.throwMe(error, new CrudException("Failed to create item", 500));
    }
  };

  /**
   * Updates a DriveFile item
   *
   * @param {string} id - the id of the DriveFile to update.
   * @param {Partial<DriveFile>} content - the updated content
   * @param {DriveExecutionContext} context - the company execution context
   * @returns {Promise<DriveFile>} - the updated DriveFile
   */
  update = async (
    id: string,
    content: Partial<DriveFile>,
    context: CompanyExecutionContext,
  ): Promise<DriveFile> => {
    if (!context) {
      this.logger.error("invalid execution context");
      return null;
    }

    try {
      let oldParent = null;
      const level = await getAccessLevel(id, null, this.repository, context);
      const hasAccess = hasAccessLevel("write", level);

      if (!hasAccess) {
        this.logger.error("user does not have access drive item ", id);
        throw Error("user does not have access to this item");
      }

      const item = await this.repository.findOne({
        company_id: context.company.id,
        id,
      });

      if (!item) {
        this.logger.error("Drive item not found");
        throw Error("Item not found");
      }

      if (content.id && content.id !== id) {
        this.logger.error("content mismatch");
        throw Error("content mismatch");
      }

      const updatable = ["access_info", "name", "tags", "parent_id", "description", "is_in_trash"];

      for (const key of updatable) {
        if ((content as any)[key]) {
          if (
            key === "parent_id" &&
            !(await canMoveItem(item.id, content.parent_id, this.repository, context))
          ) {
            throw Error("Move operation not permitted");
          } else {
            oldParent = item.parent_id;
          }
          if (key === "access_info") {
            const sharedWith = content.access_info.entities.filter(
              info =>
                !item.access_info.entities.find(entity => entity.id === info.id) &&
                info.type === "user",
            );

            item.access_info = content.access_info;

            if (sharedWith.length > 0) {
              // Notify the user that the document has been shared with them
              this.logger.info("Notifying user that the document has been shared with them: ", {
                sharedWith,
              });
              gr.services.documents.engine.notifyDocumentShared({
                context,
                item,
                notificationEmitter: context.user.id,
                notificationReceiver: sharedWith[0].id,
              });
            }

            item.access_info.entities.forEach(async info => {
              if (!info.grantor) {
                info.grantor = context.user.id;
              }
            });
          } else if (key === "name") {
            item.name = await getItemName(
              content.parent_id || item.parent_id,
              item.id,
              content.name,
              item.is_directory,
              this.repository,
              context,
            );
          } else {
            (item as any)[key] = (content as any)[key];
          }
        }
      }

      //We cannot do a change that would make the item unreachable
      if (
        level === "manage" &&
        !(await checkAccess(item.id, item, "manage", this.repository, context))
      ) {
        throw new Error("Cannot change access level to make the item unreachable");
      }

      await this.repository.save(item);
      await updateItemSize(item.parent_id, this.repository, context);

      if (oldParent) {
        item.scope = await getItemScope(item, this.repository, context);
        this.repository.save(item);

        await updateItemSize(oldParent, this.repository, context);
        this.notifyWebsocket(oldParent, context);
      }

      this.notifyWebsocket(item.parent_id, context);

      if (item.parent_id === this.TRASH) {
        //When moving to trash we recompute the access level to make them flat
        item.access_info = await makeStandaloneAccessLevel(
          item.company_id,
          item.id,
          item,
          this.repository,
        );
      }

      return item;
    } catch (error) {
      console.error(error);
      this.logger.error({ error: `${error}` }, "Failed to update drive item");
      throw new CrudException("Failed to update item", 500);
    }
  };

  /**
   * deletes or moves to Trash a Drive Document and its children
   *
   * @param {string} id - the item id
   * @param item
   * @param {DriveExecutionContext} context - the execution context
   * @returns {Promise<void>}
   */
  delete = async (
    id: string | RootType | TrashType,
    item?: DriveFile,
    context?: DriveExecutionContext,
  ): Promise<void> => {
    if (!id) {
      //We can't remove the root folder
      return;
    }

    //In the case of the trash we definitively delete the items
    if (id === "trash") {
      //Only administrators can execute this action
      const role = await gr.services.companies.getUserRole(context.company.id, context.user?.id);
      if (hasCompanyAdminLevel(role) === false) {
        throw new CrudException("Only administrators can empty the trash", 403);
      }

      try {
        const itemsInTrash = await this.repository.find(
          {
            company_id: context.company.id,
            parent_id: "trash",
          },
          {},
          context,
        );
        await Promise.all(
          itemsInTrash.getEntities().map(async item => {
            await this.delete(item.id, item, context);
          }),
        );
      } catch (error) {
        this.logger.error({ error: `${error}` }, "Failed to empty trash");
        throw new CrudException("Failed to empty trash", 500);
      }

      return;
    } else {
      item =
        item ||
        (await this.repository.findOne({
          company_id: context.company.id,
          id,
        }));

      if (!item) {
        this.logger.error("item to delete not found");
        throw new CrudException("Drive item not found", 404);
      }

      try {
        if (!(await checkAccess(item.id, item, "manage", this.repository, context))) {
          this.logger.error("user does not have access drive item ", id);
          throw Error("user does not have access to this item");
        }
      } catch (error) {
        this.logger.error({ error: `${error}` }, "Failed to grant access to the drive item");
        throw new CrudException("User does not have access to this item or its children", 401);
      }

      const previousParentId = item.parent_id;
      if (
        (await isInTrash(item, this.repository, context)) ||
        item.parent_id === this.TRASH ||
        (await getPath(item.parent_id, this.repository, true, context))[0].id === this.TRASH
      ) {
        //This item is already in trash, we can delete it definitively

        if (item.is_directory) {
          //We delete the children
          const children = await this.repository.find(
            {
              company_id: context.company.id,
              parent_id: item.id,
            },
            {},
            context,
          );
          await Promise.all(
            children.getEntities().map(async child => {
              await this.delete(child.id, child, context);
            }),
          );
        } else {
          //Delete the version and stored file
          const itemVersions = await this.fileVersionRepository.find(
            {
              drive_item_id: item.id,
            },
            {},
            context,
          );
          await Promise.all(
            itemVersions.getEntities().map(async version => {
              await this.fileVersionRepository.remove(version);
              await gr.services.files.delete(version.file_metadata.external_id, context);
            }),
          );
        }
        await this.repository.remove(item);
      } else {
        //This item is not in trash, we move it to trash
        item.is_in_trash = true;
        await this.update(item.id, item, context);
      }
      await updateItemSize(previousParentId, this.repository, context);

      await this.notifyWebsocket(previousParentId, context);
    }

    await this.notifyWebsocket("trash", context);
  };

  /**
   * restore a Drive Document and its children
   *
   * @param {string} id - the item id
   * @param {DriveExecutionContext} context - the execution context
   * @returns {Promise<void>}
   */
  restore = async (
    id: string | RootType | TrashType,
    item?: DriveFile,
    context?: DriveExecutionContext,
  ): Promise<void> => {
    if (!id) {
      //We can't remove the root folder
      return;
    }

    item =
      item ||
      (await this.repository.findOne({
        company_id: context.company.id,
        id,
      }));

    if (!item) {
      this.logger.error("item to delete not found");
      throw new CrudException("Drive item not found", 404);
    }

    try {
      if (!(await checkAccess(item.id, item, "manage", this.repository, context))) {
        this.logger.error("user does not have access drive item ", id);
        throw Error("user does not have access to this item");
      }
    } catch (error) {
      this.logger.error({ error: `${error}` }, "Failed to grant access to the drive item");
      throw new CrudException("User does not have access to this item or its children", 401);
    }

    if (isInTrash(item, this.repository, context)) {
      if (item.is_in_trash != true) {
        if (item.scope === "personal") {
          item.parent_id = "user_" + context.user.id;
        } else {
          item.parent_id = "root";
        }
      } else {
        item.is_in_trash = false;
      }
    }
    this.repository.save(item);

    this.notifyWebsocket("trash", context);
  };

  /**
   * Create a Drive item version
   *
   * @param {string} id - the Drive item id to create a version for.
   * @param {Partial<FileVersion>} version - the version item.
   * @param {DriveExecutionContext} context - the company execution context
   * @returns {Promise<FileVersion>} - the created FileVersion
   */
  createVersion = async (
    id: string,
    version: Partial<FileVersion>,
    context: DriveExecutionContext,
  ): Promise<FileVersion> => {
    if (!context) {
      this.logger.error("invalid execution context");
      return null;
    }

    try {
      const hasAccess = await checkAccess(id, null, "write", this.repository, context);
      if (!hasAccess) {
        this.logger.error("user does not have access drive item ", id);
        throw Error("user does not have access to this item");
      }

      const item = await this.repository.findOne(
        {
          id,
          company_id: context.company.id,
        },
        {},
        context,
      );

      if (!item) {
        throw Error("Drive item not found");
      }

      if (item.is_directory) {
        throw Error("cannot create version for a directory");
      }

      const driveItemVersion = getDefaultDriveItemVersion(version, context);
      const metadata = await getFileMetadata(driveItemVersion.file_metadata.external_id, context);

      driveItemVersion.file_size = metadata.size;
      driveItemVersion.file_metadata.size = metadata.size;
      driveItemVersion.file_metadata.name = metadata.name;
      driveItemVersion.file_metadata.mime = metadata.mime;
      driveItemVersion.file_metadata.thumbnails = metadata.thumbnails;
      driveItemVersion.drive_item_id = item.id;
      if (context.user.application_id) {
        driveItemVersion.application_id = context.user.application_id;
      }

      await this.fileVersionRepository.save(driveItemVersion);

      item.last_version_cache = driveItemVersion;
      item.size = driveItemVersion.file_size;

      await this.repository.save(item);

      // Notify the user that the document versions have been updated
      this.logger.info("Notifying user that the document has been updated: ", {
        item,
        notificationEmitter: context.user.id,
      });
      gr.services.documents.engine.notifyDocumentVersionUpdated({
        context,
        item,
        notificationEmitter: context.user.id,
        notificationReceiver: item.creator,
      });

      this.notifyWebsocket(item.parent_id, context);
      await updateItemSize(item.parent_id, this.repository, context);

      globalResolver.platformServices.messageQueue.publish<DocumentsMessageQueueRequest>(
        "services:documents:process",
        {
          data: {
            item,
            version: driveItemVersion,
            context,
          },
        },
      );

      return driveItemVersion;
    } catch (error) {
      this.logger.error({ error: `${error}` }, "Failed to create Drive item version");
      throw new CrudException("Failed to create Drive item version", 500);
    }
  };

  downloadGetToken = async (
    ids: string[],
    versionId: string | null,
    context: DriveExecutionContext,
  ): Promise<string> => {
    for (const id of ids) {
      const item = await this.get(id, context);
      if (!item) {
        throw new CrudException("Drive item not found", 404);
      }
    }

    return globalResolver.platformServices.auth.sign({
      ids,
      version_id: versionId,
      company_id: context.company.id,
      user_id: context.user?.id,
    });
  };

  applyDownloadTokenToContext = async (
    ids: string[],
    versionId: string | null,
    token: string,
    context: DriveExecutionContext,
  ): Promise<void> => {
    try {
      const v = globalResolver.platformServices.auth.verifyTokenObject<{
        ids: string[];
        version_id: string;
        company_id: string;
        user_id: string;
      }>(token);
      if (
        ids.some(a => !(v?.ids || [])?.includes(a)) ||
        (v?.version_id && versionId && v?.version_id !== versionId)
      ) {
        return;
      }

      context.company = { id: v.company_id };
      context.user = { id: v.user_id };
    } catch (e) {
      if (token) throw new CrudException("Invalid token", 401);
    }
  };

  download = async (
    id: string,
    versionId: string | null,
    context: DriveExecutionContext,
  ): Promise<{
    archive?: archiver.Archiver;
    file?: {
      file: internal.Readable;
      name: string;
      mime: string;
      size: number;
    };
  }> => {
    const item = await this.get(id, context);

    if (item.item.is_directory) {
      return { archive: await this.createZip([id], context) };
    }

    let version = item.item.last_version_cache;
    if (versionId) version = item.versions.find(version => version.id === versionId);
    if (!version) {
      throw new CrudException("Version not found", 404);
    }

    const fileId = version.file_metadata.external_id;
    const file = await globalResolver.services.files.download(fileId, context);

    return { file };
  };

  /**
   * Creates a zip archive containing the drive items.
   *
   * @param {string[]} ids - the drive item list
   * @param {DriveExecutionContext} context - the execution context
   * @returns {Promise<archiver.Archiver>} the created archive.
   */
  createZip = async (
    ids: string[] = [],
    context: DriveExecutionContext,
  ): Promise<archiver.Archiver> => {
    if (!context) {
      this.logger.error("invalid execution context");
      return null;
    }

    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    for (const id of ids) {
      if (!(await checkAccess(id, null, "read", this.repository, context))) {
        this.logger.warn(`not enough permissions to download ${id}, skipping`);
        return;
      }

      try {
        await addDriveItemToArchive(id, null, archive, this.repository, context);
      } catch (error) {
        console.error(error);
        this.logger.warn("failed to add item to archive", error);
      }
    }

    archive.finalize();

    return archive;
  };

  notifyWebsocket = async (id: string, context: DriveExecutionContext) => {
    websocketEventBus.publish(RealtimeEntityActionType.Event, {
      type: "documents:updated",
      room: ResourcePath.get(`/companies/${context.company.id}/documents/item/${id}`),
      entity: {
        companyId: context.company.id,
        id: id,
      },
      resourcePath: null,
      result: null,
    });
  };

  /**
   * Search for Drive items.
   *
   * @param {SearchDocumentsOptions} options - the search optins.
   * @param {DriveExecutionContext} context - the execution context.
   * @returns {Promise<ListResult<DriveFile>>} - the search result.
   */
  search = async (
    options: SearchDocumentsOptions,
    context?: DriveExecutionContext,
  ): Promise<ListResult<DriveFile>> => {
    const result = await this.searchRepository.search(
      {},
      {
        pagination: {
          limitStr: "100",
        },
        $in: [
          ...(options.onlyDirectlyShared ? [["access_entities", [context.user.id]] as inType] : []),
          ...(options.company_id ? [["company_id", [options.company_id]] as inType] : []),
          ...(options.creator ? [["creator", [options.creator]] as inType] : []),
          ...(options.mime_type
            ? [
                [
                  "mime_type",
                  Array.isArray(options.mime_type) ? options.mime_type : [options.mime_type],
                ] as inType,
              ]
            : []),
        ],
        $lte: [
          ...(options.last_modified_lt
            ? [["last_modified", options.last_modified_lt] as comparisonType]
            : []),
          ...(options.added_lt ? [["added", options.added_lt] as comparisonType] : []),
        ],
        $gte: [
          ...(options.last_modified_gt
            ? [["last_modified", options.last_modified_gt] as comparisonType]
            : []),
          ...(options.added_gt ? [["added", options.added_gt] as comparisonType] : []),
        ],
        ...(options.search
          ? {
              $text: {
                $search: options.search,
              },
            }
          : {}),
        ...(options.sort ? { $sort: options.sort } : {}),
      },
      context,
    );

    // if this flag is on, the access permissions were checked inside the database
    if (!options.onlyDirectlyShared) {
      const filteredResult = await this.filter(result.getEntities(), async item => {
        try {
          // Check access for each item
          return await checkAccess(item.id, null, "read", this.repository, context);
        } catch (error) {
          this.logger.warn("failed to check item access", error);
          return false;
        }
      });

      return new ListResult(result.type, filteredResult, result.nextPage);
    }

    if (options.onlyUploadedNotByMe) {
      const filteredResult = await this.filter(result.getEntities(), async item => {
        return item.creator != context.user.id;
      });

      return new ListResult(result.type, filteredResult, result.nextPage);
    }

    return result;
  };

  private async filter(arr, callback) {
    const fail = Symbol();
    return (
      await Promise.all(arr.map(async item => ((await callback(item)) ? item : fail)))
    ).filter(i => i !== fail);
  }

  getTab = async (tabId: string, context: CompanyExecutionContext): Promise<DriveTdriveTab> => {
    return await this.driveTdriveTabRepository.findOne(
      { company_id: context.company.id, tab_id: tabId },
      {},
      context,
    );
  };

  setTab = async (
    tabId: string,
    channelId: string,
    itemId: string,
    level: "read" | "write",
    context: CompanyExecutionContext,
  ): Promise<DriveTdriveTab> => {
    const hasAccess = await checkAccess(itemId, null, "manage", this.repository, context);

    if (!hasAccess) {
      throw new CrudException("Not enough permissions", 403);
    }

    const previousTabConfiguration = await this.getTab(tabId, context);
    const item = await this.repository.findOne(
      {
        company_id: context.company.id,
        id: itemId,
      },
      {},
      context,
    );

    await this.driveTdriveTabRepository.save(
      Object.assign(new DriveTdriveTabEntity(), {
        company_id: context.company.id,
        tab_id: tabId,
        channel_id: channelId,
        item_id: itemId,
        level,
      }),
      context,
    );

    await this.update(
      item.id,
      {
        ...item,
        access_info: {
          ...item.access_info,
          entities: [
            ...(item.access_info?.entities || []).filter(
              e =>
                !previousTabConfiguration ||
                !(e.type === "channel" && e.id !== previousTabConfiguration.channel_id),
            ),
            {
              type: "channel",
              id: channelId,
              level: level === "write" ? "write" : "read",
              grantor: context.user.id,
            },
          ],
        },
      },
      context,
    );

    return await this.getTab(tabId, context);
  };
}
