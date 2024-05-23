import { FastifyReply, FastifyRequest } from "fastify";
import {
  CrudException,
  ExecutionContext,
} from "../../../../core/platform/framework/api/crud-service";
import { CrudController } from "../../../../core/platform/services/webserver/types";
import {
  ResourceCreateResponse,
  ResourceDeleteResponse,
  ResourceGetResponse,
  ResourceListResponse,
  ResourceUpdateResponse,
} from "../../../../utils/types";
import gr from "../../../global-resolver";
import {
  ApplicationObject,
  PublicApplicationObject,
  getApplicationObject,
  getPublicObject,
} from "../../entities/application";
import { ApplicationEventRequestBody } from "../types";

export class ApplicationController
  implements
    CrudController<
      ResourceGetResponse<PublicApplicationObject>,
      ResourceUpdateResponse<PublicApplicationObject>,
      ResourceListResponse<PublicApplicationObject>,
      ResourceDeleteResponse
    >
{
  async get(
    request: FastifyRequest<{ Params: { application_id: string } }>,
  ): Promise<ResourceGetResponse<ApplicationObject | PublicApplicationObject>> {
    const context = getExecutionContext(request);

    const entity = await gr.services.applications.marketplaceApps.get(
      request.params.application_id,
      context,
    );

    const companyUser = await gr.services.companies.getCompanyUser(
      { id: entity.company_id },
      { id: context.user.id },
    );

    const isAdmin = companyUser && companyUser.role == "admin";

    return {
      resource: isAdmin ? getApplicationObject(entity) : getPublicObject(entity),
    };
  }

  async event(
    request: FastifyRequest<{
      Body: ApplicationEventRequestBody;
      Params: { application_id: string };
    }>,
    _reply: FastifyReply,
  ): Promise<ResourceCreateResponse<any>> {
    const context = getExecutionContext(request);

    const content = request.body.data;

    const applicationEntity = await gr.services.applications.marketplaceApps.get(
      request.params.application_id,
      context,
    );

    if (!applicationEntity) {
      throw CrudException.notFound("Application not found");
    }

    const companyUser = gr.services.companies.getCompanyUser(
      { id: request.body.company_id },
      { id: context.user.id },
    );

    if (!companyUser) {
      throw CrudException.badRequest(
        "You cannot send event to an application from another company",
      );
    }

    const applicationInCompany = await gr.services.applications.companyApps.get({
      company_id: request.body.company_id,
      application_id: request.params.application_id,
      id: undefined,
    });

    if (!applicationInCompany) {
      throw CrudException.badRequest("Application isn't installed in this company");
    }

    const hookResponse = await gr.services.applications.hooks.notifyApp(
      request.params.application_id,
      request.body.connection_id,
      context.user.id,
      request.body.type,
      request.body.name,
      content,
      request.body.company_id,
      request.body.workspace_id,
      context,
    );

    return {
      resource: hookResponse,
    };
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
