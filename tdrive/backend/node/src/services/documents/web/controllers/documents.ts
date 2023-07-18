import { FastifyReply, FastifyRequest } from "fastify";
import { getInstance } from "../../../../services/user/entities/user";
import { logger } from "../../../../core/platform/framework";
import { CrudException, ListResult } from "../../../../core/platform/framework/api/crud-service";
import { File } from "../../../../services/files/entities/file";
import { UploadOptions } from "../../../../services/files/types";
import globalResolver from "../../../../services/global-resolver";
import { PaginationQueryParameters, ResourceWebsocket } from "../../../../utils/types";
import { DriveFile } from "../../entities/drive-file";
import { FileVersion } from "../../entities/file-version";
import {
  CompanyExecutionContext,
  DriveExecutionContext,
  DriveFileAccessLevel,
  DriveItemDetails,
  DriveTdriveTab,
  ItemRequestParams,
  RequestParams,
  SearchDocumentsBody,
  SearchDocumentsOptions,
} from "../../types";
import { DriveFileDTO } from "../dto/drive-file-dto";
import { DriveFileDTOBuilder } from "../../services/drive-file-dto-builder";
import { ExecutionContext } from "../../../../core/platform/framework/api/crud-service";
import gr from "../../../global-resolver";

export class DocumentsController {
  private driveFileDTOBuilder = new DriveFileDTOBuilder();

  private getCompanyUserRole(companyId: string, userId: string, context?: ExecutionContext) {
    return gr.services.companies
      .getCompanyUser({ id: companyId }, { id: userId }, context)
      .then(a => (a ? a.level : null));
  }

  /**
   * Creates a DriveFile item
   *
   * @param {FastifyRequest} request
   * @returns
   */
  create = async (
    request: FastifyRequest<{
      Params: RequestParams;
      Querystring: Record<string, string>;
      Body: {
        item: Partial<DriveFile>;
        version: Partial<FileVersion>;
      };
    }>,
  ): Promise<DriveFile> => {
    try {
      const context = getDriveExecutionContext(request);

      let createdFile: File = null;
      if (request.isMultipart()) {
        const file = await request.file();
        const q = request.query;
        const options: UploadOptions = {
          totalChunks: parseInt(q.resumableTotalChunks || q.total_chunks) || 1,
          totalSize: parseInt(q.resumableTotalSize || q.total_size) || 0,
          chunkNumber: parseInt(q.resumableChunkNumber || q.chunk_number) || 1,
          filename: q.resumableFilename || q.filename || file?.filename || undefined,
          type: q.resumableType || q.type || file?.mimetype || undefined,
          waitForThumbnail: !!q.thumbnail_sync,
          ignoreThumbnails: false,
        };

        createdFile = await globalResolver.services.files.save(null, file, options, context);
      }

      const { item, version } = request.body;

      return await globalResolver.services.documents.documents.create(
        createdFile,
        item,
        version,
        context,
      );
    } catch (error) {
      logger.error({ error: `${error}` }, "Failed to create Drive item");
      CrudException.throwMe(error, new CrudException("Failed to create Drive item", 500));
    }
  };

  /**
   * Deletes a DriveFile item or empty the trash or delete root folder contents
   *
   * @param {FastifyRequest} request
   * @param {FastifyReply} reply
   * @returns {Promise<void>}
   */
  delete = async (
    request: FastifyRequest<{ Params: ItemRequestParams; Querystring: { public_token?: string } }>,
    reply: FastifyReply,
  ): Promise<void> => {
    try {
      const context = getDriveExecutionContext(request);

      await globalResolver.services.documents.documents.delete(request.params.id, null, context);

      reply.status(200).send();
    } catch (error) {
      logger.error({ error: `${error}` }, "Failed to delete drive item");
      throw new CrudException("Failed to delete drive item", 500);
    }
  };

  /**
   * Lists the drive root folder.
   *
   * @param {FastifyRequest} request
   * @returns {Promise<DriveItemDetails>}
   */
  listRootFolder = async (
    request: FastifyRequest<{
      Params: RequestParams;
      Querystring: PaginationQueryParameters & { public_token?: string };
    }>,
  ): Promise<DriveItemDetails> => {
    const context = getDriveExecutionContext(request);

    return await globalResolver.services.documents.documents.get(null, context);
  };

  /**
   * Fetches a DriveFile item.
   *
   * @param {FastifyRequest} request
   * @returns {Promise<DriveItemDetails>}
   */
  get = async (
    request: FastifyRequest<{
      Params: ItemRequestParams;
      Querystring: PaginationQueryParameters & { public_token?: string };
    }>,
  ): Promise<DriveItemDetails & { websockets: ResourceWebsocket[] }> => {
    const context = getDriveExecutionContext(request);
    const { id } = request.params;

    return {
      ...(await globalResolver.services.documents.documents.get(id, context)),
      websockets: request.currentUser?.id
        ? globalResolver.platformServices.realtime.sign(
            [{ room: `/companies/${context.company.id}/documents/item/${id}` }],
            request.currentUser?.id,
          )
        : [],
    };
  };

  /**
   * Browse file, special endpoint for TDrive application widget.
   * Returns the current folder with the filtered content
   *
   * @param {FastifyRequest} request
   * @returns {Promise<DriveItemDetails>}
   */
  browse = async (
    request: FastifyRequest<{
      Params: ItemRequestParams;
      Body: SearchDocumentsBody;
      Querystring: PaginationQueryParameters & { public_token?: string };
    }>,
  ): Promise<DriveItemDetails & { websockets: ResourceWebsocket[] }> => {
    const context = getDriveExecutionContext(request);
    const { id } = request.params;

    const companyUserRole = await this.getCompanyUserRole(
      request.body.company_id || context.company.id,
      context.user.id,
    );

    const options: SearchDocumentsOptions = {
      ...request.body,
      company_id: request.body.company_id || context.company.id,
      view: DriveFileDTOBuilder.VIEW_SHARED_WITH_ME,
      onlyDirectlyShared: true,
      onlyUploadedNotByMe: true,
    };

    let data = {
      ...(await globalResolver.services.documents.documents.browse(id, options, context)),
      websockets: request.currentUser?.id
        ? globalResolver.platformServices.realtime.sign(
            [{ room: `/companies/${context.company.id}/documents/item/${id}` }],
            request.currentUser?.id,
          )
        : [],
    };

    if (id == "root" && companyUserRole < 1) {
      data.children = [];
      data.access = "read";
    }

    return data;
  };

  sharedWithMe = async (
    request: FastifyRequest<{
      Params: RequestParams;
      Body: SearchDocumentsBody;
      Querystring: { public_token?: string };
    }>,
  ): Promise<ListResult<DriveFileDTO>> => {
    try {
      const context = getDriveExecutionContext(request);

      const options: SearchDocumentsOptions = {
        ...request.body,
        company_id: request.body.company_id || context.company.id,
        view: DriveFileDTOBuilder.VIEW_SHARED_WITH_ME,
        onlyDirectlyShared: true,
        onlyUploadedNotByMe: true,
      };

      if (!Object.keys(options).length) {
        this.throw500Search();
      }

      const fileList = await globalResolver.services.documents.documents.search(options, context);

      return this.driveFileDTOBuilder.build(fileList, context, options.fields, options.view);
    } catch (error) {
      logger.error({ error: `${error}` }, "error while searching for document");
      this.throw500Search();
    }
  };

  /**
   * Return access level of a given user on a given item
   */
  getAccess = async (
    request: FastifyRequest<{
      Params: ItemRequestParams & { user_id: string };
    }>,
  ): Promise<{ access: DriveFileAccessLevel | "none" }> => {
    const context = getDriveExecutionContext(request);
    const { id } = request.params;
    const { user_id } = request.params;

    const access = await globalResolver.services.documents.documents.getAccess(
      id,
      user_id,
      context,
    );

    if (!access) {
      throw new CrudException("Item not found", 404);
    }

    return {
      access,
    };
  };

  /**
   * Update drive item
   *
   * @param {FastifyRequest} request
   * @returns {Promise<DriveFile>}
   */
  update = async (
    request: FastifyRequest<{
      Params: ItemRequestParams;
      Body: Partial<DriveFile>;
      Querystring: { public_token?: string };
    }>,
  ): Promise<DriveFile> => {
    const context = getDriveExecutionContext(request);
    const { id } = request.params;
    const update = request.body;

    if (!id) throw new CrudException("Missing id", 400);

    return await globalResolver.services.documents.documents.update(id, update, context);
  };

  updateLevel = async (
    request: FastifyRequest<{
      Params: ItemRequestParams;
      Body: Partial<DriveFile> | any;
      Querystring: { public_token?: string };
    }>,
  ): Promise<any> => {
    const context = getDriveExecutionContext(request);
    const { id } = request.params;
    const update = request.body;

    if (!id) throw new CrudException("Missing id", 400);
    if (id == "root") {
      const companyUser = await globalResolver.services.companies.getCompanyUser(
        { id: update.company_id },
        { id: update.user_id },
      );
      if (companyUser) {
        let level = 0;
        if (update.level == "manage") {
          level = 1;
        }
        await globalResolver.services.companies.setUserRole(
          update.company_id,
          update.user_id,
          companyUser.role,
          level,
        );
      }
    }
    return {};
  };

  /**
   * Create a drive file version.
   *
   * @param {FastifyRequest} request
   * @returns {Promise<FileVersion>}
   */
  createVersion = async (
    request: FastifyRequest<{
      Params: ItemRequestParams;
      Body: Partial<FileVersion>;
      Querystring: { public_token?: string };
    }>,
  ): Promise<FileVersion> => {
    const context = getDriveExecutionContext(request);
    const { id } = request.params;
    const version = request.body;

    if (!id) throw new CrudException("Missing id", 400);

    return await globalResolver.services.documents.documents.createVersion(id, version, context);
  };

  downloadGetToken = async (
    request: FastifyRequest<{
      Params: ItemRequestParams;
      Querystring: { version_id?: string; items?: string; public_token?: string };
    }>,
  ): Promise<{ token: string }> => {
    const ids = (request.query.items || "").split(",");
    const context = getDriveExecutionContext(request);
    return {
      token: await globalResolver.services.documents.documents.downloadGetToken(
        ids,
        request.query.version_id,
        context,
      ),
    };
  };

  /**
   * Shortcut to download a file (you can also use the file-service directly).
   * If the item is a folder, a zip will be automatically generated.
   *
   * @param {FastifyRequest} request
   * @param {FastifyReply} response
   */
  download = async (
    request: FastifyRequest<{
      Params: ItemRequestParams;
      Querystring: { version_id?: string; token?: string; public_token?: string };
    }>,
    response: FastifyReply,
  ): Promise<void> => {
    const context = getDriveExecutionContext(request);
    const id = request.params.id || "";
    const versionId = request.query.version_id || null;
    const token = request.query.token;
    await globalResolver.services.documents.documents.applyDownloadTokenToContext(
      [id],
      versionId,
      token,
      context,
    );

    try {
      const archiveOrFile = await globalResolver.services.documents.documents.download(
        id,
        versionId,
        context,
      );

      if (archiveOrFile.archive) {
        const archive = archiveOrFile.archive;

        archive.on("finish", () => {
          response.status(200);
        });

        archive.on("error", () => {
          response.internalServerError();
        });

        archive.pipe(response.raw);
      } else if (archiveOrFile.file) {
        const data = archiveOrFile.file;
        const filename = data.name.replace(/[^a-zA-Z0-9 -_.]/g, "");

        response.header("Content-disposition", `attachment; filename="${filename}"`);
        if (data.size) response.header("Content-Length", data.size);
        response.type(data.mime);
        response.send(data.file);
      }
    } catch (error) {
      logger.error({ error: `${error}` }, "failed to download file");
      throw new CrudException("Failed to download file", 500);
    }
  };

  /**
   * Downloads a zip archive containing the drive items.
   *
   * @param {FastifyRequest} request
   * @param {FastifyReply} reply
   */
  downloadZip = async (
    request: FastifyRequest<{
      Params: RequestParams;
      Querystring: { token?: string; items: string; public_token?: string };
    }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const context = getDriveExecutionContext(request);
    let ids = (request.query.items || "").split(",");
    const token = request.query.token;

    await globalResolver.services.documents.documents.applyDownloadTokenToContext(
      ids,
      null,
      token,
      context,
    );

    if (ids[0] === "root") {
      const items = await globalResolver.services.documents.documents.get(ids[0], context);
      ids = items.children.map(item => item.id);
    }

    try {
      const archive = await globalResolver.services.documents.documents.createZip(ids, context);

      archive.on("finish", () => {
        reply.status(200);
      });

      archive.on("error", () => {
        reply.internalServerError();
      });

      archive.pipe(reply.raw);
    } catch (error) {
      logger.error({ error: `${error}` }, "failed to send zip file");
      throw new CrudException("Failed to create zip file", 500);
    }
  };
  /**
   * Search for documents.
   *
   * @param {FastifyRequest} request
   * @returns {Promise<ListResult<DriveFile>>}
   */
  search = async (
    request: FastifyRequest<{
      Params: RequestParams;
      Body: SearchDocumentsBody;
      Querystring: { public_token?: string };
    }>,
  ): Promise<ListResult<DriveFileDTO>> => {
    try {
      const context = getDriveExecutionContext(request);

      const options: SearchDocumentsOptions = {
        ...request.body,
        company_id: request.body.company_id || context.company.id,
        onlyDirectlyShared: false,
      };

      if (!Object.keys(options).length) {
        this.throw500Search();
      }

      const fileList = await globalResolver.services.documents.documents.search(options, context);

      return this.driveFileDTOBuilder.build(fileList, context, options.fields, options.view);
    } catch (error) {
      logger.error({ error: `${error}` }, "error while searching for document");
      this.throw500Search();
    }
  };

  private throw500Search() {
    throw new CrudException("Failed to search for documents", 500);
  }

  getTab = async (
    request: FastifyRequest<{
      Params: { tab_id: string; company_id: string };
    }>,
  ): Promise<DriveTdriveTab> => {
    const context = getCompanyExecutionContext(request);
    const { tab_id } = request.params;

    return await globalResolver.services.documents.documents.getTab(tab_id, context);
  };

  setTab = async (
    request: FastifyRequest<{
      Params: { tab_id: string; company_id: string };
      Body: DriveTdriveTab;
    }>,
  ): Promise<DriveTdriveTab> => {
    const context = getCompanyExecutionContext(request);
    const { tab_id } = request.params;

    if (!request.body.channel_id || !request.body.item_id)
      throw new Error("Missing parameters (channel_id, item_id)");

    return await globalResolver.services.documents.documents.setTab(
      tab_id,
      request.body.channel_id,
      request.body.item_id,
      request.body.level,
      context,
    );
  };

  async getAnonymousToken(
    req: FastifyRequest<{
      Body: {
        company_id: string;
        document_id: string;
        token: string;
        token_password?: string;
      };
    }>,
  ): Promise<{
    access_token: {
      time: number;
      expiration: number;
      refresh_expiration: number;
      value: string;
      refresh: string;
      type: string;
    };
  }> {
    const document = await globalResolver.services.documents.documents.get(req.body.document_id, {
      public_token: req.body.token + (req.body.token_password ? "+" + req.body.token_password : ""),
      user: null,
      company: { id: req.body.company_id },
    });

    if (!document || !document.access || document.access === "none")
      throw new CrudException("You don't have access to this document", 401);

    const email = `anonymous@${document.item.company_id}.tdrive.com`;
    let user = await globalResolver.services.users.getByEmail(email);
    if (!user) {
      user = (
        await globalResolver.services.users.create(
          getInstance({
            first_name: "Anonymous",
            last_name: "",
            email_canonical: email,
            username_canonical: (email.replace("@", ".") || "").toLocaleLowerCase(),
            phone: "",
            identity_provider: "anonymous",
            identity_provider_id: email,
            mail_verified: true,
          }),
        )
      ).entity;
    }
    await globalResolver.services.companies.setUserRole(document.item.company_id, user.id, "guest");

    const token = globalResolver.platformServices.auth.generateJWT(user.id, user.email_canonical, {
      track: false,
      provider_id: "tdrive",
      public_token_document_id: req.body.document_id,
    });

    return {
      access_token: token,
    };
  }
}

/**
 * Gets the company execution context
 *
 * @param { FastifyRequest<{ Params: { company_id: string } }>} req
 * @returns {CompanyExecutionContext}
 */
const getDriveExecutionContext = (
  req: FastifyRequest<{ Params: { company_id: string } }>,
): DriveExecutionContext => ({
  user: req.currentUser,
  company: { id: req.params.company_id },
  url: req.url,
  method: req.routerMethod,
  reqId: req.id,
  transport: "http",
});

function getCompanyExecutionContext(
  request: FastifyRequest<{
    Params: { company_id: string };
  }>,
): CompanyExecutionContext {
  return {
    user: request.currentUser,
    company: { id: request.params.company_id },
    url: request.url,
    method: request.routerMethod,
    reqId: request.id,
    transport: "http",
  };
}
