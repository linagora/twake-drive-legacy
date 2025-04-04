import SearchRepository from "../../../core/platform/services/search/repository";
import { getLogger, logger, TdriveLogger } from "../../../core/platform/framework";
import {
  CrudException,
  ListResult,
  Pagination,
} from "../../../core/platform/framework/api/crud-service";
import Repository, {
  AtomicCompareAndSetResult,
  comparisonType,
  inType,
} from "../../../core/platform/services/database/services/orm/repository/repository";
import { PublicFile } from "../../../services/files/entities/file";
import globalResolver from "../../../services/global-resolver";
import { hasCompanyAdminLevel } from "../../../utils/company";
import gr from "../../global-resolver";
import { AVStatus, DriveFile, EditingSessionKeyFormat, TYPE } from "../entities/drive-file";
import { FileVersion, TYPE as FileVersionType } from "../entities/file-version";
import User, { TYPE as UserType } from "../../user/entities/user";

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
  NotificationActionType,
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
  ThrottledArchive,
} from "../utils";
import { getConfigOrDefault } from "../../../utils/get-config";
import {
  checkAccess,
  getAccessLevel,
  hasAccessLevel,
  makeStandaloneAccessLevel,
  getItemScope,
} from "./access-check";
import archiver from "archiver";
import internal from "stream";
import { MultipartFile } from "@fastify/multipart";
import { UploadOptions } from "src/services/files/types";
import { SortType } from "src/core/platform/services/search/api";
import ApplicationsApiService, { ApplicationEditingKeyStatus } from "../../applications-api";

export class DocumentsService {
  version: "1";
  repository: Repository<DriveFile>;
  searchRepository: SearchRepository<DriveFile>;
  fileVersionRepository: Repository<FileVersion>;
  driveTdriveTabRepository: Repository<DriveTdriveTabEntity>;
  userRepository: Repository<User>;
  ROOT: RootType = "root";
  TRASH: TrashType = "trash";
  quotaEnabled: boolean = getConfigOrDefault<boolean>("drive.featureUserQuota", false);
  defaultQuota: number = getConfigOrDefault<number>("drive.defaultUserQuota", 0);
  manageAccessEnabled: boolean = getConfigOrDefault<boolean>("drive.featureManageAccess", false);
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
      this.userRepository = await globalResolver.database.getRepository<User>(UserType, User);
    } catch (error) {
      logger.error({ error: `${error}` }, "Error while initializing Documents Service");
      throw error;
    }

    return this;
  }

  browse = async (
    id: string,
    options: SearchDocumentsOptions,
    context: DriveExecutionContext & { public_token?: string },
  ): Promise<BrowseDetails> => {
    if (isSharedWithMeFolder(id)) {
      return this.sharedWithMe(options, context);
    } else {
      return {
        nextPage: null,
        ...(await this.get(id, options, context, false)),
      };
    }
  };

  sharedWithMe = async (
    options: SearchDocumentsOptions,
    context: DriveExecutionContext & { public_token?: string },
  ): Promise<BrowseDetails> => {
    if (options.pagination) {
      if (options.pagination.page_token == "1") {
        delete options.pagination.page_token;
      }
    }

    if (options.sort) {
      options.sort = this.getSortFieldMapping(options.sort);
    }

    // Handle pagination differently for non-MongoDB platforms
    globalResolver.platformServices.search.handlePagination(options);

    const fileList: ListResult<DriveFile> = await this.search(options, context);
    const result = fileList.getEntities();

    return {
      access: "read",
      children: result,
      nextPage: fileList.nextPage,
      path: [] as Array<DriveFile>,
    };
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
    options: SearchDocumentsOptions,
    context: DriveExecutionContext & { public_token?: string },
    all?: boolean,
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

    let sortField = {};
    if (options?.sort) {
      sortField = this.getSortFieldMapping(options.sort);
    }

    // Initialize pagination
    let pagination;

    if (options?.pagination)
      pagination = globalResolver.database.getConnector().getOffsetPagination(options.pagination);

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
            all
              ? {}
              : {
                  sort: {
                    is_directory: "desc",
                    ...sortField,
                  },
                  pagination,
                },
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

  /**
   * Fetches a drive element by its `editing_session_key`
   *
   * @param {string} editing_session_key - the editing_session_key of the DriveFile to fetch
   * @param {DriveExecutionContext} context
   * @returns {Promise<DriveItemDetails>}
   */
  getByEditingSessionKey = async (
    editing_session_key: string,
    context: DriveExecutionContext & { public_token?: string },
  ): Promise<DriveFile> => {
    if (!editing_session_key) {
      this.logger.error("Invalid editing_session_key: " + JSON.stringify(editing_session_key));
      throw new CrudException("Invalid editing_session_key", 400);
    }
    if (!context) {
      this.logger.error("invalid context");
      return null;
    }
    const entity = await this.repository.findOne({ editing_session_key }, {}, context);
    if (!entity) {
      this.logger.error("Drive item not found");
      throw new CrudException("Item not found", 404);
    }
    //Check access to entity
    try {
      //TODO: may need to check for read only if we permit readonly editors to join
      const hasAccess = await checkAccess(entity.id, entity, "write", this.repository, context);
      if (!hasAccess) {
        this.logger.error("user does not have access drive item " + entity.id);
        throw Error("user does not have access to this item");
      }
    } catch (error) {
      this.logger.error({ error: `${error}` }, "Failed to grant access to the drive item");
      throw new CrudException("User does not have access to this item or its children", 401);
    }
    return entity;
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

      let fileToProcess;
      if (file || driveItem.is_directory === false) {
        if (file) {
          fileToProcess = file;
        } else if (driveItemVersion.file_metadata.external_id) {
          fileToProcess = await globalResolver.services.files.getFile(
            {
              id: driveItemVersion.file_metadata.external_id,
              company_id: driveItem.company_id,
            },
            context,
            { waitForThumbnail: false },
          );
        }

        if (fileToProcess) {
          // if quota is enabled, check if the user has enough space
          await this.checkQuotaAndCleanUp(
            fileToProcess.upload_data.size,
            fileToProcess.id,
            context,
          );

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
        if (!isVirtualFolder(driveItem.parent_id)) {
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

          if (context.user.id !== parentItem?.creator && sharedWith.length > 0) {
            // Notify the owner that the document has been shared with them
            this.logger.info("Notifying the onwer that the document has been shared with them: ", {
              sharedWith,
            });
            gr.services.documents.engine.notifyDocumentShared({
              context,
              item: driveItem,
              type: NotificationActionType.UPDATE,
              notificationEmitter: context.user.id,
              notificationReceiver: parentItem.creator,
            });
          }
        }
      } catch (error) {
        logger.error(error, "🚀🚀 error:");
      }

      await this.repository.save(driveItem);
      driveItemVersion.drive_item_id = driveItem.id;

      await this.fileVersionRepository.save(driveItemVersion);
      driveItem.last_version_cache = driveItemVersion;

      await this.repository.save(driveItem);

      //TODO[ASH] update item size only for files, there is not need to do during direcotry creation
      await updateItemSize(driveItem.parent_id, this.repository, context);

      // If AV feature is enabled, scan the file
      if (!driveItem.is_directory && globalResolver.services.av?.avEnabled && version) {
        try {
          driveItem.av_status = await globalResolver.services.av.scanDocument(
            driveItem,
            driveItemVersion,
            async (av_status: AVStatus) => {
              // Update the AV status of the file
              await this.handleAVStatusUpdate(driveItem, av_status, context);
              // Handle preview generation
              if (av_status === "safe" && fileToProcess) {
                const file = await globalResolver.services.files.generatePreview(
                  fileToProcess,
                  {
                    waitForThumbnail: true,
                    ignoreThumbnails: false,
                  },
                  context,
                );
                if (file) {
                  driveItemVersion.file_metadata.thumbnails = file?.thumbnails;
                  await this.fileVersionRepository.save(driveItemVersion);
                  driveItem.last_version_cache = driveItemVersion;
                }
              }
            },
            context,
          );
          await this.repository.save(driveItem);
          if (driveItem.av_status === "skipped") {
            // Notify the user that the document has been skipped
            await this.notifyAVScanAlert(driveItem, context);
          }
        } catch (error) {
          this.logger.error(`Error scanning file ${driveItemVersion.file_metadata.external_id}`);
          CrudException.throwMe(error, new CrudException("Failed to scan file", 500));
        }
      }

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

      let updatable = ["access_info", "name", "tags", "parent_id", "description", "is_in_trash"];

      // Check if AV feature is enabled and file is malicious
      if (globalResolver.services.av?.avEnabled && item.av_status === "malicious") {
        updatable = ["is_in_trash"];
      }

      let renamedTo: string | undefined;
      for (const key of updatable) {
        if ((content as any)[key]) {
          if (
            key === "parent_id" &&
            oldParent !== item.parent_id &&
            !(await canMoveItem(item.id, content.parent_id, this.repository, context))
          ) {
            throw Error("Move operation not permitted");
          } else {
            oldParent = item.parent_id;
            const newParentId = content.parent_id;
            const needRenameTo = await getItemName(
              newParentId,
              item.id,
              item.name,
              item.is_directory,
              this.repository,
              context,
            );
            if (needRenameTo !== item.name) renamedTo = item.name = needRenameTo;
          }
          if (key === "access_info") {
            // if manage access is disabled, we don't allow changing access level
            if (!this.manageAccessEnabled) {
              delete content.access_info;
            } else if (content.access_info) {
              const sharedWith = content.access_info.entities.filter(
                info =>
                  info.type === "user" &&
                  info.id !== context.user.id &&
                  !item.access_info.entities.find(entity => entity.id === info.id),
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
                  type: NotificationActionType.DIRECT,
                  notificationEmitter: context.user.id,
                  notificationReceiver: sharedWith[0].id,
                });
              }

              item.access_info.entities.forEach(info => {
                if (!info.grantor) {
                  info.grantor = context.user.id;
                }
              });
            }
          } else if (key === "name") {
            renamedTo = item.name = await getItemName(
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
        await this.repository.save(item);

        await updateItemSize(oldParent, this.repository, context);
      }
      if (renamedTo && item.editing_session_key)
        ApplicationsApiService.getDefault()
          .renameEditingKeyFilename(item.editing_session_key, renamedTo)
          .catch(err => {
            logger.error("Error rename editing session to new name", {
              err,
              editing_session_key: item.editing_session_key,
              renamedTo,
            });
            /* Ignore errors, just throw it out there... */
          });
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
    } catch (err) {
      this.logger.error({ err }, "Failed to update drive item");
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
      const path = await getPath(item.parent_id, this.repository, true, context);
      const previousParentId = item.parent_id;
      if (
        (await isInTrash(item, this.repository, context)) ||
        item.parent_id === this.TRASH ||
        path[0].id === this.TRASH
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
        // Check item belongs to someone
        if (item.creator !== context?.user?.id) {
          const creator = await this.userRepository.findOne({ id: item.creator });
          //if the file was created by an application or anonymous user
          if (creator == null || creator.type === "anonymous") {
            const loadedCreators = new Map<string, User>();
            let firstOwnedItem: DriveFile | undefined;
            for (let i = path.length - 1; i >= 0; i--) {
              const item = path[i];
              if (!item.creator) continue;
              const user =
                loadedCreators.get(item.creator) ??
                (await this.userRepository.findOne({ id: item.creator }));
              loadedCreators.set(item.creator, user);
              if (user.type !== "anonymous") {
                firstOwnedItem = item;
                break;
              }
            }
            if (firstOwnedItem) {
              const firstKnownCreator = loadedCreators.get(firstOwnedItem.creator);
              const accessEntitiesWithoutUser = item.access_info.entities.filter(
                ({ id, type }) => type != "user" || id != firstKnownCreator.id,
              );
              item.access_info.entities = [
                ...accessEntitiesWithoutUser,
                // This is not functionally required, but creates an audit trace of what
                // happened to this anonymously uploaded file
                {
                  type: "user",
                  id: firstKnownCreator.id,
                  level: "manage",
                  grantor: context.user.id,
                },
              ];
              item.creator = firstKnownCreator.id;
            } else {
              // Move to company trash
              item.parent_id = "trash";
              item.scope = "shared";
            }
            await this.repository.save(item);
          }
        }

        await this.update(item.id, item, context);
      }
      await updateItemSize(previousParentId, this.repository, context);
    }
  };

  /**
   * restore a Drive Document and its children
   *
   * @param {string} id - the item id
   * @param item item to restore
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

    // Check if AV feature is enabled and file is malicious
    if (globalResolver.services.av?.avEnabled && item.av_status === "malicious") {
      this.logger.error("Cannot update a malicious file");
      throw new CrudException("Cannot update a malicious file", 403);
    }

    if (await isInTrash(item, this.repository, context)) {
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
    await this.repository.save(item);
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
      const fileToProcess = await globalResolver.services.files.getFile(
        {
          id: driveItemVersion.file_metadata.external_id,
          company_id: context.company.id,
        },
        context,
      );
      const metadata = await getFileMetadata(driveItemVersion.file_metadata.external_id, context);

      // if quota is enabled, check if the user has enough space
      await this.checkQuotaAndCleanUp(metadata.size, metadata.external_id, context);

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
      item.last_modified = driveItemVersion.date_added;

      await this.repository.save(item);

      // Notify the user that the document versions have been updated
      if (context.user.id !== item.creator) {
        this.logger.info("Notifying user that the document has been updated: ", {
          item,
          notificationEmitter: context.user.id,
        });
        gr.services.documents.engine.notifyDocumentVersionUpdated({
          context,
          item,
          type: NotificationActionType.UPDATE,
          notificationEmitter: context.user.id,
          notificationReceiver: item.creator,
        });
      }

      await updateItemSize(item.parent_id, this.repository, context);

      // If AV feature is enabled, scan the file
      if (globalResolver.services.av?.avEnabled && version) {
        try {
          item.av_status = await globalResolver.services.av.scanDocument(
            item,
            driveItemVersion,
            async (av_status: AVStatus) => {
              // Update the AV status of the file
              await this.handleAVStatusUpdate(item, av_status, context);
              // Handle preview generation
              if (av_status === "safe" && fileToProcess) {
                const file = await globalResolver.services.files.generatePreview(
                  fileToProcess,
                  {
                    waitForThumbnail: true,
                    ignoreThumbnails: false,
                  },
                  context,
                );
                if (file) {
                  driveItemVersion.file_metadata.thumbnails = file?.thumbnails;
                  await this.fileVersionRepository.save(driveItemVersion);
                  item.last_version_cache = driveItemVersion;
                }
              }
            },
            context,
          );
          await this.repository.save(item);
          if (item.av_status === "skipped") {
            // Notify the user that the document has been skipped
            await this.notifyAVScanAlert(item, context);
          }
        } catch (error) {
          this.logger.error(`Error scanning file ${driveItemVersion.file_metadata.external_id}`);
          CrudException.throwMe(error, new CrudException("Failed to scan file", 500));
        }
      }

      await globalResolver.platformServices.messageQueue.publish<DocumentsMessageQueueRequest>(
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
      logger.error({ error: `${error}` }, "Failed to create Drive item version");
      CrudException.throwMe(error, new CrudException("Failed to create Drive item version", 500));
    }
  };

  /**
   * Checks if directory contains malicious files
   *
   * @param {string} id - the dir id to check.
   * @param {DriveExecutionContext} context - the company execution context
   * @returns {Promise<boolean>} - the check result
   */
  containsMaliciousFiles = async (id: string, context: DriveExecutionContext): Promise<boolean> => {
    if (!context) {
      this.logger.error("Invalid execution context");
      return null;
    }

    try {
      // Check user access
      const hasAccess = await checkAccess(id, null, "read", this.repository, context);
      if (!hasAccess) {
        this.logger.error("User does not have access to drive item", id);
        throw new Error("User does not have access to this item");
      }

      // Retrieve the item
      const item = await this.repository.findOne(
        { company_id: context.company.id, id },
        {},
        context,
      );

      if (!item) {
        throw new Error("Drive item not found");
      }

      if (!item.is_directory) {
        throw new Error("Cannot check malicious files for a file");
      }

      // Retrieve children
      const children = await this.repository.find(
        { company_id: context.company.id, parent_id: id },
        {},
        context,
      );

      const entities = children.getEntities();

      // Check files in the current directory
      const maliciousFiles = entities.filter(
        child =>
          !child.is_directory && child.av_status && !["uploaded", "safe"].includes(child.av_status),
      );

      if (maliciousFiles.length > 0) {
        return true;
      }

      // Recursively check subdirectories
      const subdirectories = entities.filter(child => child.is_directory);
      for (const subdirectory of subdirectories) {
        const hasMaliciousFiles = await this.containsMaliciousFiles(subdirectory.id, context);
        if (hasMaliciousFiles) {
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error({ error: `${error}` }, "Failed to check malicious files");
      CrudException.throwMe(error, new CrudException("Failed to check malicious files", 500));
    }
  };

  /**
   * Triggers an AV Rescan for the document.
   *
   * @param {string} id - the Drive item id to rescan.
   * @param {DriveExecutionContext} context - the company execution context
   * @returns {Promise<DriveFile>} - the DriveFile after the rescan has been triggered
   */
  rescan = async (id: string, context: DriveExecutionContext): Promise<DriveFile> => {
    if (!context) {
      this.logger.error("Invalid execution context");
      throw new Error("Execution context is required"); // Explicit error to indicate a fatal issue
    }

    try {
      const hasAccess = await checkAccess(id, null, "write", this.repository, context);
      if (!hasAccess) {
        this.logger.warn(`Access denied for user to drive item ${id}`);
        throw new Error("User does not have access to this item");
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
        this.logger.warn(`Drive item ${id} not found`);
        throw new Error("Drive item not found");
      }

      if (item.is_directory) {
        this.logger.warn(`Attempted to rescan a directory ${id}`);
        throw new Error("Cannot rescan a directory");
      }

      if (globalResolver.services.av?.avEnabled) {
        try {
          item.av_status = await globalResolver.services.av.scanDocument(
            item,
            item.last_version_cache,
            async (av_status: AVStatus) => {
              await this.handleAVStatusUpdate(item, av_status, context);
            },
            context,
          );

          await this.repository.save(item);

          if (item.av_status === "skipped") {
            this.logger.info(`AV scan skipped for file ${item.id}`);
            await this.notifyAVScanAlert(item, context);
          }
        } catch (scanError) {
          this.logger.error(
            `Error scanning file ${item.last_version_cache.file_metadata.external_id}: ${scanError.message}`,
          );
          throw new CrudException("Error scanning file", 500);
        }
      } else {
        this.logger.error("AV scanning is not enabled");
        throw new Error("An unexpected error occurred. Please try again later.");
      }

      return item;
    } catch (error) {
      this.logger.error({ error: `${error}` }, `Failed to rescan drive item ${id}`);
      throw new CrudException("Failed to rescan the drive item", 500);
    }
  };

  /**
   * If not already in an editing session, uses the `editing_session_key` of the
   * `DriveFile` entity to store a unique new value to expect an update later
   * with only that key provided.
   * @param id DriveFile ID of the document to begin editing
   * @param editorApplicationId Editor/Application/Plugin specific identifier
   * @param appInstanceId For that `editorApplicationId` a unique identifier
   *   when multiple instances are running. Unused today - would need a mapping
   *   from `appInstanceId` to server host.
   * @param context
   * @returns An object in the format `{}` with the unique identifier for the
   *   editing session
   */
  beginEditing = async (
    id: string,
    editorApplicationId: string,
    appInstanceId: string,
    context: DriveExecutionContext,
  ) => {
    if (!context) {
      this.logger.error("invalid execution context");
      return null;
    }
    if (
      !editorApplicationId ||
      !ApplicationsApiService.getDefault().getApplicationConfig(editorApplicationId)
    ) {
      logger.error(`Missing or invalid application ID: ${JSON.stringify(editorApplicationId)}`);
      CrudException.throwMe(
        new Error("Unknown appId"),
        new CrudException("Missing or invalid application ID", 400),
      );
    }
    const spinLoopUntilEditable = async (
      provider: {
        generateKey: () => string;
        atomicSet: (
          key: string | null,
          previous: string | null,
        ) => Promise<AtomicCompareAndSetResult<string>>;
        getPluginKeyStatus: (key: string) => Promise<ApplicationEditingKeyStatus>;
      },
      attemptCount = 8,
      tarpitS = 1,
      tarpitWorsenCoeff = 1.2,
    ) => {
      while (attemptCount-- > 0) {
        const newKey = provider.generateKey();
        const swapResult = await provider.atomicSet(newKey, null);
        logger.debug(`Begin edit try ${newKey}, got: ${JSON.stringify(swapResult)}`);
        if (swapResult.didSet) return newKey;
        if (!swapResult.currentValue) continue; // glitch in the matrix but ok because atomicCompareAndSet is not actually completely atomic
        const existingStatus = await provider.getPluginKeyStatus(swapResult.currentValue);
        logger.debug(`Begin edit get status of ${newKey}: ${JSON.stringify(existingStatus)}`);
        switch (existingStatus) {
          case ApplicationEditingKeyStatus.unknown:
          case ApplicationEditingKeyStatus.live:
            return swapResult.currentValue;
          case ApplicationEditingKeyStatus.updated:
          case ApplicationEditingKeyStatus.expired:
            logger.debug(`Begin edit emptying previous ${swapResult.currentValue}`);
            await provider.atomicSet(null, swapResult.currentValue);
            break;
          default:
            throw new Error(
              `Unexpected ApplicationEditingKeyStatus: ${JSON.stringify(existingStatus)}`,
            );
        }
        await new Promise(resolve => setTimeout(resolve, tarpitS * 1000));
        tarpitS *= tarpitWorsenCoeff;
      }
    };

    const hasAccess = await checkAccess(id, null, "write", this.repository, context);
    if (!hasAccess) {
      logger.error("user does not have access drive item " + id);
      CrudException.throwMe(
        new Error("user does not have access to the drive item"),
        new CrudException("user does not have access drive item", 401),
      );
    }

    try {
      const driveFile = await this.repository.findOne(
        {
          id,
          company_id: context.company.id,
        },
        {},
        context,
      );
      const editingSessionKey = await spinLoopUntilEditable({
        atomicSet: (key, previous) =>
          this.repository.atomicCompareAndSet(driveFile, "editing_session_key", previous, key),
        generateKey: () =>
          EditingSessionKeyFormat.generate(
            editorApplicationId,
            appInstanceId,
            context.company.id,
            context.user.id,
          ),
        getPluginKeyStatus: key =>
          ApplicationsApiService.getDefault().checkPendingEditingStatus(key),
      });
      return { editingSessionKey };
    } catch (error) {
      logger.error({ error: `${error}` }, "Failed to begin editing Drive item");
      CrudException.throwMe(error, new CrudException("Failed to begin editing Drive item", 500));
    }
  };

  /**
   * End editing session either by providing a URL to a new file to create a version,
   * or not, to just cancel the session.
   * @param editing_session_key Editing key of the DriveFile
   * @param file Multipart files from the incoming http request
   * @param options Optional upload information from the request
   * @param keepEditing If `true`, the file will be saved as a new version,
   *  and the DriveFile will keep its editing_session_key. If `true`, a file is required.
   * @param userId When authentified by the root token of an application, this user
   *  will override the creator of this version
   * @param context
   */
  updateEditing = async (
    editing_session_key: string,
    file: MultipartFile,
    options: UploadOptions,
    keepEditing: boolean,
    userId: string | null,
    context: CompanyExecutionContext,
  ) => {
    //TODO rethink the locking stuff shouldn't be just forgotten
    //TODO Make this accept even if missing and act ok about it,
    // store to dump folder or such
    if (!context) {
      this.logger.error("invalid execution context");
      return null;
    }
    if (!editing_session_key) {
      this.logger.error("Invalid editing_session_key: " + JSON.stringify(editing_session_key));
      throw new CrudException("Invalid editing_session_key", 400);
    }
    try {
      const parsedKey = EditingSessionKeyFormat.parse(editing_session_key);
      context = {
        ...context,
        company: { id: parsedKey.companyId },
      };

      if (context.user.id === context.user.application_id && context.user.application_id) {
        context = {
          ...context,
          user: {
            ...context.user,
            id: userId || parsedKey.userId,
          },
        };
      }
    } catch (e) {
      this.logger.error(
        "Invalid editing_session_key value: " + JSON.stringify(editing_session_key),
        e,
      );
      throw new CrudException("Invalid editing_session_key", 400);
    }

    const driveFile = await this.repository.findOne({ editing_session_key }, {}, context);
    if (!driveFile) {
      this.logger.error("Drive item not found by editing session key");
      throw new CrudException("Item not found by editing session key", 404);
    }

    const hasAccess = await checkAccess(driveFile.id, driveFile, "write", this.repository, context);
    if (!hasAccess) {
      logger.error("user does not have access drive item " + driveFile.id);
      CrudException.throwMe(
        new Error("user does not have access to the drive item"),
        new CrudException("user does not have access drive item", 401),
      );
    }

    if (file) {
      const fileEntity = await globalResolver.services.files.save(
        null,
        file.file,
        {
          ...options,
          filename: options.filename ?? driveFile.name,
        },
        context,
      );

      await globalResolver.services.documents.documents.createVersion(
        driveFile.id,
        {
          drive_item_id: driveFile.id,
          provider: "internal",
          file_metadata: {
            external_id: fileEntity.id,
            source: "internal",
            name: file.filename ?? driveFile.name,
          },
        },
        context,
      );
    } else if (keepEditing) {
      this.logger.error("Inconsistent endEditing call");
      throw new CrudException("Inconsistent endEditing call", 500);
    }

    if (!keepEditing) {
      try {
        const result = await this.repository.atomicCompareAndSet(
          driveFile,
          "editing_session_key",
          editing_session_key,
          null,
        );
        if (!result.didSet)
          throw new Error(
            `Couldn't set editing_session_key ${JSON.stringify(
              editing_session_key,
            )} on DriveFile ${JSON.stringify(driveFile.id)} because it is ${JSON.stringify(
              result.currentValue,
            )}`,
          );
      } catch (error) {
        logger.error(
          { error: `${error}` },
          `Failed to ${keepEditing ? "update" : "end"} editing Drive item`,
        );
        CrudException.throwMe(
          error,
          new CrudException(`Failed to ${keepEditing ? "update" : "end"} editing Drive item`, 500),
        );
      }
    }
  };

  downloadGetToken = async (
    ids: string[],
    versionId: string | null,
    context: DriveExecutionContext,
  ): Promise<string> => {
    for (const id of ids) {
      const item = await this.get(id, null, context);
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
  /**
   *
   * @param id DriveItemID to download. If it's a folder, a zip file will be returned
   * @param versionId Optional specific version to download
   * @param {Function} beginArchiveTransmit If a folder,
   *   called when the zip file can begin streaming, otherwise not called at all.
   */
  download = async (
    id: string,
    versionId: string | null,
    beginArchiveTransmit: (readable: archiver.Archiver) => void,
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
    const item = await this.get(id, null, context);

    if (item.item.is_directory) {
      return { archive: await this.createZip([id], beginArchiveTransmit, context) };
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
   * @param {Function} beginArchiveTransmit - Called when the zip file can begin streaming
   * @param {DriveExecutionContext} context - the execution context
   * @returns {Promise<archiver.Archiver>} the created archive.
   */
  createZip = async (
    ids: string[] = [],
    beginArchiveTransmit: (archive: archiver.Archiver) => void,
    context: DriveExecutionContext,
  ): Promise<archiver.Archiver> => {
    if (!context) {
      this.logger.error("invalid execution context");
      return null;
    }

    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    const throttledArchive = new ThrottledArchive(archive, async ({ readable, name, prefix }) => {
      archive.append(readable, { name, prefix });
    });

    archive.on("error", error => {
      this.logger.error("error while creating ZIP file: ", error);
    });

    let didBeginTransmission = false;
    for (const id of ids) {
      if (!(await checkAccess(id, null, "read", this.repository, context))) {
        this.logger.warn({ id }, `not enough permissions to download ${id}, skipping`);
        continue;
      }

      try {
        await addDriveItemToArchive(
          id,
          null,
          throttledArchive,
          archive => {
            if (didBeginTransmission) return;
            didBeginTransmission = true;
            beginArchiveTransmit(archive);
          },
          this.repository,
          context,
        );
      } catch (err) {
        this.logger.warn({ err, id }, "failed to add item to archive");
      }
    }
    if (!didBeginTransmission) beginArchiveTransmit(archive);

    await throttledArchive.waitUntilEmptied();

    //TODO[ASH] why do we need this call??
    archive.finalize();

    return archive;
  };

  /**
   * Search for Drive items.
   *
   * @param {SearchDocumentsOptions} options - the search options.
   * @param {DriveExecutionContext} context - the execution context.
   * @returns {Promise<ListResult<DriveFile>>} - the search result.
   */
  search = async (
    options: SearchDocumentsOptions,
    context?: DriveExecutionContext,
  ): Promise<ListResult<DriveFile>> => {
    const allResults: DriveFile[] = [];
    let nextPage = options.pagination
      ? Pagination.fromPaginable(options.pagination)
      : new Pagination();
    let resultType: string | null = null; // Step 1: Declare before loop
    const resultPageSize = parseInt(options.pagination?.limitStr || "100");

    // loop through all pages until we get results
    do {
      const result = await this.searchRepository.search(
        {},
        {
          pagination: nextPage,
          $in: [
            ...(options.onlyDirectlyShared
              ? [["access_entities", [context.user.id]] as inType]
              : []),
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
          $nin: [
            ...(options.onlyUploadedNotByMe ? [["creator", [context.user.id]] as inType] : []),
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

      if (!resultType) {
        resultType = result.type; // Capture type from the first result
      }

      let filteredResult = result.getEntities();

      if (filteredResult.length === 0) {
        break;
      }

      // Check access permissions
      if (!options.onlyDirectlyShared) {
        filteredResult = await this.filter(filteredResult, async item => {
          try {
            return (
              !item.is_in_trash &&
              (await checkAccess(item.id, null, "read", this.repository, context))
            );
          } catch (error) {
            this.logger.warn("failed to check item access", error);
            return false;
          }
        });
      }

      if (options.onlyUploadedNotByMe) {
        filteredResult = filteredResult.filter(
          item => item.creator !== context.user.id && !item.is_in_trash,
        );
      }

      allResults.push(...filteredResult);
      nextPage = result.nextPage ? Pagination.fromPaginable(result.nextPage) : undefined;
    } while (allResults.length !== resultPageSize && nextPage?.page_token); // Continue only if results are empty and there's a next page.

    return new ListResult(resultType, allResults, nextPage);
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

  checkQuotaAndCleanUp = async (size: number, fileId: string, context: DriveExecutionContext) => {
    if (!this.quotaEnabled) return;

    const userQuota = await this.userQuota(context);
    const leftQuota = this.defaultQuota - userQuota;

    if (size > leftQuota) {
      await globalResolver.services.files.delete(fileId, context);
      throw new CrudException(`Not enough space: ${size}, ${leftQuota}.`, 403);
    }
  };

  getSortFieldMapping = (sort: SortType) => {
    const sortFieldMapping = {
      name: "name",
      date: "last_modified",
      size: "size",
    };

    const sortField = {};
    sortField[sortFieldMapping[sort?.by] || "last_modified"] = sort?.order || "desc";
    return sortField;
  };

  // Helper function to notify user about AV scan alert
  notifyAVScanAlert = async (item: DriveFile, context: DriveExecutionContext) => {
    await gr.services.documents.engine.notifyDocumentAVScanAlert({
      context,
      item,
      type: NotificationActionType.DIRECT,
      notificationEmitter: context.user.id,
      notificationReceiver: context.user.id,
    });
  };

  // Helper function to update AV status and save the drive item
  handleAVStatusUpdate = async (
    item: DriveFile,
    status: AVStatus,
    context: DriveExecutionContext,
  ) => {
    item.av_status = status;
    await this.repository.save(item);

    if (["malicious", "scan_failed"].includes(status)) {
      await this.notifyAVScanAlert(item, context);
    }
  };
}
