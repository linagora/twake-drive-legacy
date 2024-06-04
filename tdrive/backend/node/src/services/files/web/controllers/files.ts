import { FastifyReply, FastifyRequest } from "fastify";
import { MultipartFile } from "@fastify/multipart";
import { ResourceDeleteResponse } from "../../../../utils/types";
import { CompanyExecutionContext } from "../types";
import { UploadOptions } from "../../types";
import { PublicFile } from "../../entities/file";
import gr from "../../../global-resolver";

export class FileController {
  async save(
    request: FastifyRequest<{
      Params: { company_id: string; id: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Querystring: any;
    }>,
  ): Promise<{ resource: PublicFile }> {
    const context = getCompanyExecutionContext(request);

    let file: null | MultipartFile = null;
    if (request.isMultipart()) {
      file = await request.file();
    }
    const q: any = request.query;
    const options: UploadOptions = {
      totalChunks: parseInt(q.resumableTotalChunks || q.total_chunks) || 1,
      totalSize: parseInt(q.resumableTotalSize || q.total_size) || 0,
      chunkNumber: parseInt(q.resumableChunkNumber || q.chunk_number) || 1,
      filename: q.resumableFilename || q.filename || file?.filename || undefined,
      type: q.resumableType || q.type || file?.mimetype || undefined,
      waitForThumbnail: q.thumbnail_sync,
      ignoreThumbnails: q.ignore_thumbnails,
    };

    const id = request.params.id;
    const result = await gr.services.files.save(id, file, options, context);

    return {
      resource: result.getPublicObject(),
    };
  }

  async download(
    request: FastifyRequest<{ Params: { company_id: string; id: string } }>,
    response: FastifyReply,
  ): Promise<void> {
    const context = getCompanyExecutionContext(request);
    const params = request.params;
    try {
      const data = await gr.services.files.download(params.id, context);
      const filename = data.name.replace(/[^a-zA-Z0-9 -_.]/g, "");

      response.header("Content-disposition", `attachment; filename="${filename}"`);
      if (data.size) response.header("Content-Length", data.size);
      response.type(data.mime);
      return response.send(data.file);
    } catch (e) {
      console.log("!!!" + e);
      throw e;
    }
  }

  async checkConsistency(request: FastifyRequest, response: FastifyReply): Promise<void> {
    const data = await gr.services.files.checkConsistency();
    response.send(data);
  }

  async thumbnail(
    request: FastifyRequest<{ Params: { company_id: string; id: string; index: string } }>,
    response: FastifyReply,
  ): Promise<void> {
    const context = getCompanyExecutionContext(request);
    const params = request.params;
    try {
      const data = await gr.services.files.thumbnail(params.id, params.index, context);

      response.header("Content-disposition", "inline");
      response.expires(new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 365));
      if (data.size) response.header("Content-Length", data.size);
      response.type(data.type);
      response.send(data.file);
      return response;
    } catch (err) {
      console.log(err);
      response.statusCode = 500;
      response.send("");
    }
  }

  async get(
    request: FastifyRequest<{ Params: { company_id: string; id: string } }>,
  ): Promise<{ resource: PublicFile }> {
    const context = getCompanyExecutionContext(request);
    const params = request.params;
    const resource = await gr.services.files.get(params.id, context);

    return { resource: resource.getPublicObject() };
  }

  async delete(
    request: FastifyRequest<{ Params: { company_id: string; id: string } }>,
  ): Promise<ResourceDeleteResponse> {
    const params = request.params;
    const context = getCompanyExecutionContext(request);

    const deleteResult = await gr.services.files.delete(params.id, context);

    return { status: deleteResult.deleted ? "success" : "error" };
  }

  async checkFileS3Exists(
    request: FastifyRequest<{ Params: { company_id: string; id: string } }>,
  ): Promise<{ isInS3: boolean }> {
    const params = request.params;
    return await gr.services.files.checkFileExistsS3(params.id);
  }

  async restoreFileS3(
    request: FastifyRequest<{
      Params: { company_id: string; id: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Querystring: any;
    }>,
  ): Promise<{ resource: PublicFile }> {
    const params = request.params;
    let file: null | MultipartFile = null;
    if (request.isMultipart()) {
      file = await request.file();
    }

    const q: any = request.query;
    const options: any = {
      totalChunks: parseInt(q.resumableTotalChunks || q.total_chunks) || 1,
      chunkNumber: parseInt(q.resumableChunkNumber || q.chunk_number) || 1,
    };

    const result = await gr.services.files.restoreFileS3(params.id, file, options);

    return result;
  }
}

function getCompanyExecutionContext(
  request: FastifyRequest<{
    Params: { company_id: string };
  }>,
): CompanyExecutionContext {
  return {
    user: request.currentUser,

    company: { id: request.params.company_id },
    url: request.url,
    method: request.routeOptions.method,
    reqId: request.id,
    transport: "http",
  };
}
