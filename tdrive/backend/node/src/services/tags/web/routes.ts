import { FastifyInstance, FastifyPluginCallback, FastifyRequest } from "fastify";
import { checkUserBelongsToCompany } from "../../../utils/company";
import { Tag } from "../types";
import { TagsController } from "./controllers";
import gr from "../../global-resolver";
import CompanyUser from "../../../services/user/entities/company_user";

const tagsUrl = "/companies/:company_id/tags";

const routes: FastifyPluginCallback = (fastify: FastifyInstance, options, next) => {
  const tagsController = new TagsController();

  const accessControlCompanyOnly = async (request: FastifyRequest<{ Params: Tag }>) => {
    await checkUserBelongsToCompany(request.currentUser.id, request.params.company_id);
  };

  const accessControlOwnerOrAdmin = async (request: FastifyRequest<{ Params: Tag }>) => {
    const user: CompanyUser = await gr.services.companies.getCompanyUser(
      { id: request.params.company_id },
      { id: request.currentUser.id },
    );

    const authorization = user.role === "owner" || user.role === "admin";

    if (!authorization) {
      throw fastify.httpErrors.unauthorized("Only owner and Company Administrator have permission");
    }
  };

  fastify.route({
    method: "GET",
    url: `${tagsUrl}/:tag_id`,
    preHandler: accessControlCompanyOnly,
    preValidation: [fastify.authenticate],
    handler: tagsController.get.bind(tagsController),
  });

  fastify.route({
    method: "GET",
    url: tagsUrl,
    preHandler: accessControlCompanyOnly,
    preValidation: [fastify.authenticate],
    handler: tagsController.list.bind(tagsController),
  });

  fastify.route({
    method: "POST",
    url: tagsUrl,
    preHandler: accessControlOwnerOrAdmin,
    preValidation: [fastify.authenticate],
    handler: tagsController.save.bind(tagsController),
  });

  fastify.route({
    method: "POST",
    url: `${tagsUrl}/:tag_id`,
    preHandler: accessControlOwnerOrAdmin,
    preValidation: [fastify.authenticate],
    handler: tagsController.save.bind(tagsController),
  });

  fastify.route({
    method: "DELETE",
    url: `${tagsUrl}/:tag_id`,
    preHandler: accessControlOwnerOrAdmin,
    preValidation: [fastify.authenticate],
    handler: tagsController.delete.bind(tagsController),
  });

  next();
};

export default routes;
