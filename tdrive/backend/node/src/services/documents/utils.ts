import { spawnCheckingExitCode } from "../../utils/exec";
import archiver from "archiver";
import { merge } from "lodash";
import PdfParse from "pdf-parse";
import { Readable } from "stream";
import Repository from "../../core/platform/services/database/services/orm/repository/repository";
import {
  cleanFiles,
  getTmpFile,
  readableToBuffer,
  readFromTemporaryFile,
  writeToTemporaryFile,
} from "../../utils/files";
import mimes from "../../utils/mime";
import { Configuration } from "../../core/platform/framework";
import gr from "../global-resolver";
import { stopWords } from "./const";
import { DriveFile } from "./entities/drive-file";
import { DriveFileMetadata, FileVersion } from "./entities/file-version";
import { checkAccess, generateAccessToken } from "./services/access-check";
import {
  CompanyExecutionContext,
  DriveExecutionContext,
  RootType,
  SharedWithMeType,
  TrashType,
} from "./types";

const ROOT: RootType = "root";
const TRASH: TrashType = "trash";
const SHARED_WITH_ME: SharedWithMeType = "shared_with_me";

export const isVirtualFolder = (id: string) => {
  return (
    id === ROOT ||
    id === TRASH ||
    id.startsWith("trash_") ||
    id.startsWith("user_") ||
    id == SHARED_WITH_ME
  );
};

export const isSharedWithMeFolder = (id: string) => {
  return id === SHARED_WITH_ME;
};

export const getVirtualFoldersNames = async (id: string, context: DriveExecutionContext) => {
  const configuration = new Configuration("drive");
  const defaultLang = configuration.get<string>("defaultLanguage") || "en";
  const user = await gr.services.users.get({ id: context.user?.id });
  const locale = user?.preferences?.locale || defaultLang;

  if (id.startsWith("user_")) {
    return gr.services.i18n.translate("virtual-folder.my-drive", locale);
  }

  return id === ROOT
    ? gr.services.i18n.translate("virtual-folder.shared-drive", locale)
    : id === TRASH
    ? gr.services.i18n.translate("virtual-folder.trash", locale)
    : "Unknown";
};

/**
 * Returns the default DriveFile object using existing data
 *
 * @param {Partial<DriveFile>} item - the partial drive file item.
 * @param {CompanyExecutionContext} context - the company execution context
 * @returns {DriveFile} - the Default DriveFile
 */
export const getDefaultDriveItem = (
  item: Partial<DriveFile>,
  context: CompanyExecutionContext,
): DriveFile => {
  const defaultDriveItem = merge<DriveFile, Partial<DriveFile>>(new DriveFile(), {
    company_id: context.company.id,
    added: item.added || new Date().getTime(),
    creator: item.creator || context.user?.id,
    is_directory: item.is_directory || false,
    is_in_trash: item.is_in_trash || false,
    last_modified: new Date().getTime(),
    parent_id: item.parent_id || "root",
    content_keywords: item.content_keywords || "",
    scope: "personal",
    description: item.description || "",
    access_info: item.access_info || {
      entities: [
        {
          id: "parent",
          type: "folder",
          level: "manage",
          grantor: null,
        },
        {
          id: item.company_id,
          type: "company",
          level: "none",
          grantor: null,
        },
        {
          id: context.user?.id,
          type: "user",
          level: "manage",
          grantor: null,
        },
      ],
      public: {
        level: "none",
        password: "",
        expiration: 0,
        token: generateAccessToken(),
      },
    },
    extension: item.extension || "",
    last_version_cache: item.last_version_cache,
    name: item.name || "",
    size: item.size || 0,
    tags: item.tags || [],
  });

  if (item.id) {
    defaultDriveItem.id = item.id;
  }

  return defaultDriveItem;
};

/**
 * Returns the default FileVersion item.
 *
 * @param {Partial<FileVersion>} version - the partial version item
 * @param {CompanyExecutionContext} context - the execution context
 * @returns
 */
export const getDefaultDriveItemVersion = (
  version: Partial<FileVersion>,
  context: CompanyExecutionContext,
): FileVersion => {
  const defaultVersion = merge(new FileVersion(), {
    application_id: version.application_id || "",
    creator_id: version.creator_id || context.user?.id,
    data: version.data || {},
    date_added: version.date_added || new Date().getTime(),
    drive_item_id: version.drive_item_id || "",
    file_metadata: version.file_metadata || {},
    file_size: version.file_size || 0,
    filename: version.filename || "",
    key: version.key || "",
    mode: version.mode || "OpenSSL-2",
    provider: version.provider,
    realname: version.realname,
  });

  if (version.id) {
    defaultVersion.id = version.id;
  }

  return defaultVersion;
};

/**
 * Calculates the size of the Drive Item
 *
 * @param {DriveFile} item - The file or directory
 * @param {Repository<DriveFile>} repository - the database repository
 * @param {CompanyExecutionContext} context - the execution context
 * @returns {Promise<number>} - the size of the Drive Item
 */
export const calculateItemSize = async (
  item: DriveFile | { id: string; is_directory: boolean; size: number },
  repository: Repository<DriveFile>,
  context: CompanyExecutionContext,
): Promise<number> => {
  if (item.id === "trash") {
    const trashedItems = await repository.find(
      { company_id: context.company.id, is_in_trash: true, scope: "shared" },
      {},
      context,
    );

    return trashedItems.getEntities().reduce((acc, curr) => acc + curr.size, 0);
  }

  if (item.id === "trash_" + context.user.id) {
    const trashedItems = await repository.find(
      {
        company_id: context.company.id,
        creator: context.user.id,
        is_in_trash: true,
        scope: "personal",
      },
      {},
      context,
    );

    return trashedItems.getEntities().reduce((acc, curr) => acc + curr.size, 0);
  }

  if (isVirtualFolder(item.id) || !item) {
    const rootFolderItems = await repository.find(
      { company_id: context.company.id, parent_id: item.id || "root", is_in_trash: false },
      {},
      context,
    );

    return rootFolderItems.getEntities().reduce((acc, curr) => acc + curr.size, 0);
  }

  if (item.is_directory) {
    const children = await repository.find(
      {
        company_id: context.company.id,
        parent_id: item.id,
        is_in_trash: false,
      },
      {},
      context,
    );

    return children.getEntities().reduce((acc, curr) => acc + curr.size, 0);
  }

  return item.size;
};

/**
 * Recalculates and updates the Drive item size
 *
 * @param {string} id - the item id
 * @param {Repository<DriveFile>} repository
 * @param {CompanyExecutionContext} context - the execution context
 * @returns {Promise<void>}
 */
export const updateItemSize = async (
  id: string,
  repository: Repository<DriveFile>,
  context: CompanyExecutionContext,
): Promise<void> => {
  if (!id || isVirtualFolder(id)) return;

  const item = await repository.findOne({ id, company_id: context.company.id });

  if (!item) {
    throw Error("Drive item doesn't exist");
  }

  item.size = await calculateItemSize(item, repository, context);

  await repository.save(item);

  if (isVirtualFolder(item.parent_id)) {
    return;
  }

  await updateItemSize(item.parent_id, repository, context);
};

/**
 * Get a list of parents for the provided DriveFile id, in top-down order,
 * but internally iterated towards the top.
 *
 * @param {boolean} ignoreAccess If user from context doesn't have
 *   read access to an item, the item is not included and traversing
 *   towards parents is stopped there.
 * @param {(item: DriveFile) => Promise<boolean>} predicate If set,
 *   returned items in the array include only those for which the
 *   `predicate`'s result resolved to true.
 * @param {boolean?} stopAtFirstMatch If true, the lowest item
 *   in the hierarchy that matches the `predicate` will be the
 *   only item in the returned array.
 * @returns A promise to an array of DriveFile entries in order
 *   starting from the root (eg. "My Drive"), and ending in the
 *   DriveFile matching the provided `id` ; both included.
 *
 *   If `stopAtFirstMatch` is true and `predicate` is provided, the
 *   result is an array with a single item or an empty array.
 */
export const getPath = async (
  id: string,
  repository: Repository<DriveFile>,
  ignoreAccess?: boolean,
  context?: DriveExecutionContext,
  predicate?: (item: DriveFile) => Promise<boolean>,
  stopAtFirstMatch: boolean = false,
): Promise<DriveFile[]> => {
  id = id || "root";
  if (isVirtualFolder(id)) {
    const virtualItem = {
      id,
      name: await getVirtualFoldersNames(id, context),
    } as DriveFile;
    return (!context?.user?.public_token_document_id || ignoreAccess) &&
      (!predicate || (await predicate(virtualItem)))
      ? [virtualItem]
      : [];
  }
  const item = await repository.findOne({
    id,
    company_id: context.company.id,
  });

  if (!item || (!(await checkAccess(id, item, "read", repository, context)) && !ignoreAccess)) {
    return [];
  }
  const isMatch = !predicate || (await predicate(item));
  if (stopAtFirstMatch && isMatch) return [item];
  const parents = await getPath(
    item.parent_id,
    repository,
    ignoreAccess,
    context,
    predicate,
    stopAtFirstMatch,
  );
  return isMatch ? [...parents, item] : parents;
};

/**
 * Adds drive items to an archive recursively
 *
 * @param {string} id - the drive item id
 * @param {DriveFile | null } entity - the drive item entity
 * @param {archiver.Archiver} archive - the archive
 * @param {Repository<DriveFile>} repository - the repository
 * @param {CompanyExecutionContext} context - the execution context
 * @param {string} prefix - folder prefix
 * @returns {Promise<void>}
 */
export const addDriveItemToArchive = async (
  id: string,
  entity: DriveFile | null,
  archive: archiver.Archiver,
  repository: Repository<DriveFile>,
  context: CompanyExecutionContext,
  prefix?: string,
): Promise<void> => {
  const itemPK = { id, company_id: context.company.id };
  const item = entity || (await repository.findOne(itemPK));

  if (!item) {
    throw Error(`Item '${JSON.stringify(itemPK)}' not found`);
  }

  if (item.is_in_trash) return;

  if (!item.is_directory) {
    const file_id = item.last_version_cache.file_metadata.external_id;
    const file = await gr.services.files.download(file_id, context);

    if (!file) {
      throw Error("file not found");
    }

    archive.append(file.file, { name: file.name, prefix: prefix ?? "" });
    return;
  } else {
    const items = await repository.find({
      parent_id: item.id,
      company_id: context.company.id,
    });

    for (const child of items.getEntities()) {
      await addDriveItemToArchive(
        child.id,
        child,
        archive,
        repository,
        context,
        `${prefix || ""}${item.name}/`,
      );
    }

    return;
  }
};

/**
 * Extracts the most popular 250 keywords from a text.
 *
 * @param {string} data - file data string.
 * @returns {string}
 */
export const extractKeywords = (data: string): string => {
  const words = data.toLowerCase().split(/[^a-zA-Z']+/);
  const filteredWords = words.filter(word => !stopWords.includes(word) && word.length > 3);

  const wordFrequency = filteredWords.reduce((acc: Record<string, number>, word: string) => {
    acc[word] = (acc[word] || 0) + 1;

    return acc;
  }, {});

  const sortedFrequency = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .reduce((acc: Record<string, number>, [key, val]) => {
      acc[key] = val;

      return acc;
    }, {});

  return Object.keys(sortedFrequency).slice(0, 250).join(" ");
};

/**
 * Converts an office file stream into a human readable string.
 *
 * @param {Readable} file - the input file stream.
 * @param {string} extension - the file extension.
 * @returns {Promise<string>}
 */
export const officeFileToString = async (file: Readable, extension: string): Promise<string> => {
  const officeFilePath = await writeToTemporaryFile(file, extension);
  const outputPath = getTmpFile(".pdf");

  try {
    await spawnCheckingExitCode("unoconv", [`-o${outputPath}`, officeFilePath]);
    cleanFiles([officeFilePath]);

    return await pdfFileToString(outputPath);
  } catch (error) {
    cleanFiles([officeFilePath]);
    throw Error(error);
  }
};

/**
 * Converts a PDF file stream into a human readable string.
 *
 * @param {Readable | string} file - the input file stream or path.
 * @returns {Promise<string>}
 */
export const pdfFileToString = async (file: Readable | string): Promise<string> => {
  let inputBuffer: Buffer;

  try {
    if (typeof file === "string") {
      inputBuffer = await readFromTemporaryFile(file);
      cleanFiles([file]);
    } else {
      inputBuffer = await readableToBuffer(file);
    }

    const result = await PdfParse(inputBuffer);

    return result.text;
  } catch (error) {
    if (typeof file === "string") {
      cleanFiles([file]);
    }

    throw Error(error);
  }
};

/**
 * returns the file metadata.
 *
 * @param {string} fileId - the file id
 * @param {CompanyExecutionContext} context - the execution context
 * @returns {DriveFileMetadata}
 */
export const getFileMetadata = async (
  fileId: string,
  context: CompanyExecutionContext,
): Promise<DriveFileMetadata> => {
  const file = await gr.services.files.getFile(
    {
      id: fileId,
      company_id: context.company.id,
    },
    context,
    { ...(context.user?.server_request ? {} : { waitForThumbnail: true }) },
  );

  if (!file) {
    throw Error("File doesn't exist");
  }

  return {
    source: "internal",
    external_id: fileId,
    mime: file.metadata.mime,
    name: file.metadata.name,
    size: file.upload_data.size,
    thumbnails: file.thumbnails,
  } as DriveFileMetadata;
};

/**
 * Finds a suitable name for an item based on items inside the same folder.
 *
 * @param {string} parent_id - the parent id.
 * @param id
 * @param {string} name - the item name.
 * @param is_directory
 * @param {Repository<DriveFile>} repository - the drive repository.
 * @param {CompanyExecutionContext} context - the execution context.
 * @returns {Promise<string>} - the drive item name.
 */
export const getItemName = async (
  parent_id: string,
  id: string,
  name: string,
  is_directory: boolean,
  repository: Repository<DriveFile>,
  context: CompanyExecutionContext,
): Promise<string> => {
  try {
    let newName = name.substring(0, 255);
    let exists = true;
    const children = await repository.find(
      {
        parent_id,
        company_id: context.company.id,
      },
      {},
      context,
    );

    while (exists) {
      exists = !!children
        .getEntities()
        .find(
          child => child.name === newName && child.is_directory === is_directory && child.id !== id,
        );

      if (exists) {
        const ext = newName.split(".").pop();
        newName =
          ext && ext !== newName ? `${newName.slice(0, -ext.length - 1)}-2.${ext}` : `${newName}-2`;
      }
    }

    return newName;
  } catch (error) {
    throw Error("Failed to get item name");
  }
};

/**
 * Checks if an item can be moved to its destination
 * An item cannot be moved to itself or any of its derived chilren.
 *
 * @param {string} source - the to be moved item id.
 * @param {string} target - the to be moved to item id.
 * @param {string} repository - the Drive item repository.
 * @param {CompanyExecutionContext} context - the execution context.
 * @returns {Promise<boolean>} - whether the move is possible or not.
 */
export const canMoveItem = async (
  source: string,
  target: string,
  repository: Repository<DriveFile>,
  context: CompanyExecutionContext,
): Promise<boolean> => {
  if (source === target) return false;

  const item = await repository.findOne({
    id: source,
    company_id: context.company.id,
  });

  const targetItem = isVirtualFolder(target)
    ? null
    : await repository.findOne({
        id: target,
        company_id: context.company.id,
      });

  if (!isVirtualFolder(target) && (!targetItem || !targetItem.is_directory)) {
    throw Error("target item doesn't exist or not a directory");
  }

  if (!(await checkAccess(target, targetItem, "write", repository, context))) {
    return false;
  }

  if (!item) {
    throw Error("Item not found");
  }

  const children = (
    await repository.find({
      parent_id: source,
      company_id: context.company.id,
    })
  ).getEntities();

  if (children.some(child => child.id === target)) {
    return false;
  }

  for (const child of children) {
    if (child.is_directory && !(await canMoveItem(child.id, target, repository, context))) {
      return false;
    }
  }

  return true;
};

export function isFileType(
  fileMime: string,
  fileName: string,
  requiredExtensions: string[],
): boolean {
  const extension = fileName.split(".").pop();
  const secondaryExtensions = Object.keys(mimes).filter(k => mimes[k] === fileMime);
  const fileExtensions = [extension, ...secondaryExtensions];
  return fileExtensions.some(e => requiredExtensions.includes(e));
}

export const isInTrash = async (
  item: DriveFile,
  repository: Repository<DriveFile>,
  context: CompanyExecutionContext,
) => {
  if (item.is_in_trash === true) {
    return true;
  }

  if (isVirtualFolder(item.parent_id)) {
    return false; // Stop condition
  }

  // Retrieve the parent item
  const parentItem = await repository.findOne({
    company_id: context.company.id,
    id: item.parent_id,
  });

  // Recursively check the parent item
  return isInTrash(parentItem, repository, context);
};

import { logger } from "../../core/platform/framework";
import { officeExtensions, textExtensions, pdfExtensions } from "../../utils/mime";
import { readableToString } from "../../utils/files";

/** Return true if the given filename and mime type could be analysed by `getKeywordsOfFile` */
export const couldGetKeywordsOfFile = async (mime: string, filename: string): Promise<boolean> =>
  isFileType(mime, filename, textExtensions) ||
  isFileType(mime, filename, pdfExtensions) ||
  isFileType(mime, filename, officeExtensions);

/** Extract keyword text from the provided readable */
export const getKeywordsOfFile = async (
  mime: string,
  filename: string,
  file: Readable,
): Promise<string> => {
  let content_strings = "";
  const extension = filename.split(".").pop();
  if (isFileType(mime, filename, textExtensions)) {
    logger.info(`Processing text file:   ${filename}`);
    content_strings = await readableToString(file);
  }
  if ((content_strings ?? "").trim().length == 0 && isFileType(mime, filename, pdfExtensions)) {
    logger.info(`Processing PDF file:    ${filename}`);
    content_strings = await pdfFileToString(file);
  }
  if ((content_strings ?? "").trim().length == 0 && isFileType(mime, filename, officeExtensions)) {
    logger.info(`Processing office file: ${filename}`);
    content_strings = await officeFileToString(file, extension);
  }
  return extractKeywords(content_strings);
};
