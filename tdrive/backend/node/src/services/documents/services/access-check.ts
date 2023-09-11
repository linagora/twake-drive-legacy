import crypto from "crypto";
import _ from "lodash";
import { logger } from "../../../core/platform/framework";
import Repository from "../../../core/platform/services/database/services/orm/repository/repository";
import globalResolver from "../../global-resolver";
import { AccessInformation, AuthEntity, DriveFile } from "../entities/drive-file";
import { CompanyExecutionContext, DriveFileAccessLevel } from "../types";

/**
 * Generates a random sha1 access token
 *
 * @returns {String} - the random access token ( sha1 hex digest ).
 */
export const generateAccessToken = (): string => {
  const randomBytes = crypto.randomBytes(64);

  return crypto.createHash("sha1").update(randomBytes).digest("hex");
};

/**
 * Checks if the level meets the required level.
 *
 * @param {publicAccessLevel | DriveFileAccessLevel} requiredLevel
 * @param {publicAccessLevel} level
 * @returns {boolean}
 */
export const hasAccessLevel = (
  requiredLevel: DriveFileAccessLevel | "none",
  level: DriveFileAccessLevel | "none",
): boolean => {
  if (requiredLevel === level) return true;

  if (requiredLevel === "write") {
    return level === "manage";
  }

  if (requiredLevel === "read") {
    return level === "manage" || level === "write";
  }

  return requiredLevel === "none";
};

/**
 * checks the current user is a guest
 * Company guests can be users accessing with a public link
 *
 * @param {CompanyExecutionContext} context
 * @returns {Promise<boolean>}
 */
export const isCompanyGuest = async (context: CompanyExecutionContext): Promise<boolean> => {
  if (await isCompanyApplication(context)) {
    return false;
  }

  const userRole = await globalResolver.services.companies.getUserRole(
    context.company.id,
    context.user?.id,
  );

  return userRole === "guest" || !userRole;
};

/**
 * checks the current user is a member
 * Company members can access shared drive
 *
 * @param {CompanyExecutionContext} context
 * @returns {Promise<boolean>}
 */
export const isCompanyMember = async (context: CompanyExecutionContext): Promise<boolean> => {
  if (await isCompanyApplication(context)) {
    return false;
  }

  const userRole = await globalResolver.services.companies.getUserRole(
    context.company.id,
    context.user?.id,
  );

  return userRole === "member" || !userRole;
};

/**
 * checks the current user is a admin
 *
 * @param {CompanyExecutionContext} context
 * @returns {Promise<boolean>}
 */
export const isCompanyAdmin = async (context: CompanyExecutionContext): Promise<boolean> => {
  if (await isCompanyApplication(context)) {
    return true;
  }

  const userRole = await globalResolver.services.companies.getUserRole(
    context.company.id,
    context.user?.id,
  );

  return userRole === "admin";
};

/**
 * checks the current user is a admin
 *
 * @param {CompanyExecutionContext} context
 * @returns {Promise<boolean>}
 */
export const isCompanyApplication = async (context: CompanyExecutionContext): Promise<boolean> => {
  if (context.user?.application_id) {
    //Applications do everything (if they are added to the company)
    if (
      !!(
        await globalResolver.services.applications.companyApps.get({
          company_id: context.company.id,
          application_id: context.user?.application_id,
        })
      )?.application?.id
    ) {
      return true;
    }
  }
  return false;
};

/**
 * checks if access can be granted for the drive item
 *
 * @param {string} id
 * @param {DriveFile | null} item
 * @param {DriveFileAccessLevel} level
 * @param {Repository<DriveFile>} repository
 * @param {CompanyExecutionContext} context
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export const checkAccess = async (
  id: string,
  item: DriveFile | null,
  level: DriveFileAccessLevel,
  repository: Repository<DriveFile>,
  context: CompanyExecutionContext & { public_token?: string; tdrive_tab_token?: string },
): Promise<boolean> => {
  if (context.user?.server_request) {
    return true;
  }

  const grantedLevel = await getAccessLevel(id, item, repository, context);
  const hasAccess = hasAccessLevel(level, grantedLevel);
  logger.info(
    `Got level ${grantedLevel} for drive item ${id} and required ${level} - returning ${hasAccess}`,
  );
  return hasAccess;
};

/**
 * get maximum level for the drive item
 *
 * @param {string} id
 * @param {DriveFile | null} item
 * @param {Repository<DriveFile>} repository
 * @param {CompanyExecutionContext} context
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export const getAccessLevel = async (
  id: string,
  item: DriveFile | null,
  repository: Repository<DriveFile>,
  context: CompanyExecutionContext & { public_token?: string; tdrive_tab_token?: string },
): Promise<DriveFileAccessLevel | "none"> => {
  const isAdmin = !context?.user?.id || (await isCompanyAdmin(context));
  const isMember = !context?.user?.id || (await isCompanyMember(context));

  if (context?.user?.id) {
    /**
     * Drive root directories access management
     */
    if (id === "user_" + context.user?.id) return "manage";
    if (id === "trash_" + context.user?.id) return "manage";

    if (id === "root") {
      if (isAdmin) return "manage";
      if (isMember) return "read";

      return "none";
    }

    if (id === "trash") {
      if (isAdmin) return "manage";

      return "read";
    }

    if (id === "shared_with_me") return "read";

    /**
     * Entity based access management
     */

    if (item.scope === "personal" && item.creator == context.user.id) return "manage";

    if (item.scope === "shared") {
      if (isAdmin) return "manage";
      if (isMember) return "read";

      return "none";
    }
  }
  /*const isMember = !context?.user?.id || (await isCompanyMember(context));
  if (!id || id === "root") {
    if (!context?.user?.id || (await isCompanyGuest(context))) {
      return "none";
    } else {
      if (isMember) return "read";
      return "manage";
    }
  }
  if (id === "trash")
    return (await isCompanyGuest(context)) || !context?.user?.id
      ? "none"
      : (await isCompanyAdmin(context))
      ? "manage"
      : "write";
  if (id === "shared_with_me") return "read";

  //If it is my personal folder, I have full access
  if (id.startsWith("user_")) {
    if (id === "user_" + context.user?.id) return "manage";
    if (await isCompanyApplication(context)) return "manage";
    return "none";
  }*/

  let publicToken = context.public_token;
  const prevalidatedPublicTokenDocumentId = context?.user?.public_token_document_id;

  try {
    /*  if (!item) {
      item = await repository.findOne({
        id,
        company_id: context.company.id,
      });
    }

    if (!item) {
      throw Error("Drive item doesn't exist");
    }

    if (await isCompanyApplication(context)) {
      if (!id.startsWith("user_") && isMember && item.creator != context.user.id) {
        return "read";
      }
      return "manage";
    }

    /*
     * Specific user or channel rule is applied first. Then less restrictive level will be chosen
     * between the parent folder and company accesses.
     */

    //Public access
    if (publicToken || prevalidatedPublicTokenDocumentId === item.id) {
      if (!item.access_info.public.token) return "none";
      const { token: itemToken, level: itemLevel, password, expiration } = item.access_info.public;
      if (expiration && expiration < Date.now()) return "none";
      if (prevalidatedPublicTokenDocumentId) {
        return itemLevel;
      }
      if (password) {
        const data = publicToken.split("+");
        if (data.length !== 2) return "none";
        const [extractedPublicToken, publicTokenPassword] = data;
        if (publicTokenPassword !== password) return "none";
        publicToken = extractedPublicToken;
      }
      if (itemToken === publicToken) return itemLevel;
    }

    const accessEntities = item.access_info.entities || [];
    const otherLevels = [];

    //From there a user must be logged in
    if (context?.user?.id) {
      //Users
      const matchingUser = accessEntities.find(a => a.type === "user" && a.id === context.user?.id);
      if (matchingUser) return matchingUser.level;

      //Channels
      if (context.tdrive_tab_token) {
        try {
          const [channelId] = context.tdrive_tab_token.split("+"); //First item will be the channel id
          const matchingChannel = accessEntities.find(
            a => a.type === "channel" && a.id === channelId,
          );
          if (matchingChannel) return matchingChannel.level;
        } catch (e) {
          console.log(e);
        }
      }

      //Companies
      const matchingCompany = accessEntities.find(
        a => a.type === "company" && a.id === context.company.id,
      );
      if (matchingCompany && !isCompanyGuest(context)) otherLevels.push(matchingCompany.level);
    }

    //Parent folder
    const maxParentFolderLevel =
      accessEntities.find(a => a.type === "folder" && a.id === "parent")?.level || "none";
    if (maxParentFolderLevel === "none") {
      otherLevels.push(maxParentFolderLevel);
    } else {
      const parentFolderLevel = await getAccessLevel(item.parent_id, null, repository, context);
      otherLevels.push(parentFolderLevel);
    }

    //Return least restrictive level of otherLevels
    return otherLevels.reduce(
      (previousValue, b) =>
        hasAccessLevel(b as DriveFileAccessLevel, previousValue as DriveFileAccessLevel)
          ? previousValue
          : b,
      "none",
    ) as DriveFileAccessLevel | "none";
  } catch (error) {
    throw Error(error);
  }
};

/**
 * Isolate access level information from parent folder logic
 * Used when putting folder in the trash
 * @param id
 * @param item
 * @param repository
 */
export const makeStandaloneAccessLevel = async (
  companyId: string,
  id: string,
  item: DriveFile | null,
  repository: Repository<DriveFile>,
  options: { removePublicAccess?: boolean } = { removePublicAccess: true },
): Promise<DriveFile["access_info"]> => {
  item =
    item ||
    (await repository.findOne({
      id,
      company_id: companyId,
    }));

  if (!item) {
    throw Error("Drive item doesn't exist");
  }

  const accessInfo = _.cloneDeep(item.access_info);

  if (options?.removePublicAccess && accessInfo?.public?.level) accessInfo.public.level = "none";

  const parentFolderAccess = accessInfo.entities.find(
    a => a.type === "folder" && a.id === "parent",
  );

  if (!parentFolderAccess || parentFolderAccess.level === "none") {
    return accessInfo;
  } else if (item.parent_id !== "root" && item.parent_id !== "trash") {
    // Get limitations from parent folder
    const accessEntitiesFromParent = await makeStandaloneAccessLevel(
      companyId,
      item.parent_id,
      null,
      repository,
      options,
    );

    let mostRestrictiveFolderLevel = parentFolderAccess.level as DriveFileAccessLevel | "none";

    const keptEntities = accessEntitiesFromParent.entities.filter(a => {
      if (["user", "channel"].includes(a.type)) {
        return !accessInfo.entities.find(b => b.type === a.type && b.id === a.id);
      } else {
        if (a.type === "folder" && a.id === "parent") {
          mostRestrictiveFolderLevel = hasAccessLevel(a.level, mostRestrictiveFolderLevel)
            ? a.level
            : mostRestrictiveFolderLevel;
        }
        return false;
      }
    });

    accessInfo.entities = accessInfo.entities.map(a => {
      if (a.type === "folder" && a.id === "parent") {
        a.level = mostRestrictiveFolderLevel;
      }
      return a;
    }) as DriveFile["access_info"]["entities"];

    accessInfo.entities = [...accessInfo.entities, ...keptEntities];
  }

  return accessInfo;
};

export const getSharedByUser = (
  accessInfo: AccessInformation,
  context: CompanyExecutionContext,
): string => {
  // Try to find entity that matches user the most
  // at first user, and then company
  // we don't consider right now the access level by folder or channel or workspace
  for (const idx in accessInfo?.entities) {
    const entity = accessInfo.entities[idx];
    if (entity.type === "user" && entity.id === context.user?.id) {
      return getGrantorAndThrowIfEmpty(entity);
    }
    if (entity.type === "company" && entity.id === context.company.id && entity.level != "none") {
      console.log("company", entity);
      return getGrantorAndThrowIfEmpty(entity);
    }
  }
  return null;
};

const getGrantorAndThrowIfEmpty = (entity: AuthEntity) => {
  if (!entity.grantor) {
    logger.warn(`For the file permissions ${entity.id} grantor is not defined`);
    // throw CrudException.badGateway(`For the file permissions ${entity.id} grantor is not defined`);
  }
  return entity.grantor;
};
