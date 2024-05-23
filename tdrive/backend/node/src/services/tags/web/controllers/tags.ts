import { FastifyReply, FastifyRequest } from "fastify";
import { CrudController } from "../../../../core/platform/services/webserver/types";
import {
  ResourceCreateResponse,
  ResourceDeleteResponse,
  ResourceGetResponse,
  ResourceListResponse,
} from "../../../../utils/types";
import { Tag } from "../../entities";
import gr from "../../../global-resolver";
import { ExecutionContext } from "../../../../core/platform/framework/api/crud-service";
import { handleError } from "../../../../utils/handleError";

export class TagsController
  implements
    CrudController<
      ResourceGetResponse<Tag>,
      ResourceCreateResponse<Tag>,
      ResourceListResponse<Tag>,
      ResourceDeleteResponse
    >
{
  async get(
    request: FastifyRequest<{ Params: { company_id: string; tag_id: string } }>,
    reply: FastifyReply,
  ): Promise<ResourceGetResponse<Tag>> {
    try {
      const tag = await gr.services.tags.get({
        company_id: request.params.company_id,
        tag_id: request.params.tag_id,
      });
      if (tag) {
        reply.code(200);
      }
      return { resource: tag };
    } catch (err) {
      reply.code(404);
      handleError(reply, err);
    }
  }

  async list(
    request: FastifyRequest<{ Params: { company_id: string } }>,
    reply: FastifyReply,
  ): Promise<ResourceListResponse<Tag>> {
    const list = await gr.services.tags.list({
      company_id: request.params.company_id,
    });
    try {
      const resources = list.getEntities();
      if (resources) {
        reply.code(200);
      }
      return { resources };
    } catch (err) {
      handleError(reply, err);
    }
  }

  async save(
    request: FastifyRequest<{
      Params: { company_id: string; tag_id?: string };
      Body: { name: string; colour: string };
    }>,
    reply: FastifyReply,
  ): Promise<ResourceCreateResponse<Tag>> {
    const context = getExecutionContext(request);
    const tag_id = request.params.tag_id ? request.params.tag_id : "";

    const entity = {
      company_id: request.params.company_id,
      tag_id: tag_id,
      name: request.body.name,
      colour: request.body.colour,
    };

    try {
      const save_result = await gr.services.tags.save(entity, context);

      if (save_result) {
        reply.code(201);
      }

      return {
        resource: save_result.entity,
      };
    } catch (err) {
      handleError(reply, err);
    }
  }

  async delete(
    request: FastifyRequest<{ Params: { company_id: string; tag_id: string } }>,
    reply: FastifyReply,
  ): Promise<ResourceDeleteResponse> {
    const context = getExecutionContext(request);

    try {
      const deleteResult = await gr.services.tags.delete(
        {
          company_id: request.params.company_id,
          tag_id: request.params.tag_id,
        },
        context,
      );

      if (deleteResult) {
        reply.code(200);
        return {
          status: "success",
        };
      }
    } catch (err) {
      handleError(reply, err);
    }
  }
}

function getExecutionContext(request: FastifyRequest): ExecutionContext {
  return {
    user: request.currentUser,
    url: request.url,
    method: request.routeOptions.method,
    transport: "http",
  };
}
