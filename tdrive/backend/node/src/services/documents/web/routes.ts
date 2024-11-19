import { FastifyInstance, FastifyPluginCallback } from "fastify";
import { DocumentsController } from "./controllers";
import { createDocumentSchema, createVersionSchema, beginEditingSchema } from "./schemas";

const baseUrl = "/companies/:company_id";
const serviceUrl = `${baseUrl}/item`;
const editingSessionBase = "/editing_session/:editing_session_key";

const routes: FastifyPluginCallback = (fastify: FastifyInstance, _options, next) => {
  const documentsController = new DocumentsController();

  fastify.route({
    method: "GET",
    url: `${serviceUrl}`,
    preValidation: [fastify.authenticateOptional],
    handler: documentsController.listRootFolder.bind(documentsController),
  });

  fastify.route({
    method: "GET",
    url: `${serviceUrl}/:id`,
    preValidation: [fastify.authenticateOptional],
    handler: documentsController.get.bind(documentsController),
  });

  fastify.route({
    method: "POST",
    url: serviceUrl,
    preValidation: [fastify.authenticateOptional],
    schema: createDocumentSchema,
    handler: documentsController.create.bind(documentsController),
  });

  fastify.route({
    method: "POST",
    url: `${serviceUrl}/:id`,
    preValidation: [fastify.authenticateOptional],
    handler: documentsController.update.bind(documentsController),
  });

  fastify.route({
    method: "POST",
    url: `${serviceUrl}/:id/level`,
    preValidation: [fastify.authenticateOptional],
    handler: documentsController.updateLevel.bind(documentsController),
  });

  fastify.route({
    method: "DELETE",
    url: `${serviceUrl}/:id`,
    preValidation: [fastify.authenticateOptional],
    handler: documentsController.delete.bind(documentsController),
  });

  fastify.route({
    method: "POST",
    url: `${serviceUrl}/:id/restore`,
    preValidation: [fastify.authenticateOptional],
    handler: documentsController.restore.bind(documentsController),
  });

  fastify.route({
    method: "GET",
    url: `${serviceUrl}/:id/user/:user_id/access`,
    preValidation: [fastify.authenticateOptional],
    handler: documentsController.getAccess.bind(documentsController),
  });

  fastify.route({
    method: "POST",
    url: `${serviceUrl}/:id/version`,
    preValidation: [fastify.authenticateOptional],
    schema: createVersionSchema,
    handler: documentsController.createVersion.bind(documentsController),
  });

  fastify.route({
    method: "POST",
    url: `${serviceUrl}/:id/editing_session`,
    preValidation: [fastify.authenticateOptional],
    schema: beginEditingSchema,
    handler: documentsController.beginEditing.bind(documentsController),
  });

  fastify.route({
    method: "POST",
    url: `${serviceUrl}/:id/check_malware`,
    preValidation: [fastify.authenticateOptional],
    handler: documentsController.containsMaliciousFiles.bind(documentsController),
  });

  fastify.route({
    method: "POST",
    url: `${serviceUrl}/:id/rescan`,
    preValidation: [fastify.authenticateOptional],
    handler: documentsController.rescan.bind(documentsController),
  });

  fastify.route({
    method: "GET",
    url: editingSessionBase, //TODO NONONO check authenticate*Optional*
    preValidation: [fastify.authenticateOptional],
    handler: documentsController.getByEditingSessionKey.bind(documentsController),
  });

  fastify.route({
    method: "POST",
    url: editingSessionBase,
    preValidation: [fastify.authenticateOptional],
    handler: documentsController.updateEditing.bind(documentsController),
  });

  fastify.route({
    method: "DELETE",
    url: editingSessionBase,
    preValidation: [fastify.authenticateOptional],
    handler: documentsController.cancelEditing.bind(documentsController),
  });

  fastify.route({
    method: "GET",
    url: `${serviceUrl}/download/token`,
    preValidation: [fastify.authenticateOptional],
    handler: documentsController.downloadGetToken.bind(documentsController),
  });

  fastify.route({
    method: "GET",
    url: `${serviceUrl}/:id/download`,
    preValidation: [fastify.authenticate],
    handler: documentsController.download.bind(documentsController),
  });

  fastify.route({
    method: "GET",
    url: `${serviceUrl}/download/zip`,
    preValidation: [fastify.authenticate],
    handler: documentsController.downloadZip.bind(documentsController),
  });

  fastify.route({
    method: "POST",
    url: `${baseUrl}/search`,
    preValidation: [fastify.authenticate],
    handler: documentsController.search.bind(documentsController),
  });

  fastify.route({
    method: "POST",
    url: `${baseUrl}/browse/:id`,
    preValidation: [fastify.authenticate],
    handler: documentsController.browse.bind(documentsController),
  });

  fastify.route({
    method: "GET",
    url: `${baseUrl}/tabs/:tab_id`,
    preValidation: [fastify.authenticate],
    handler: documentsController.getTab.bind(documentsController),
  });

  fastify.route({
    method: "POST",
    url: `${baseUrl}/tabs/:tab_id`,
    preValidation: [fastify.authenticate],
    handler: documentsController.setTab.bind(documentsController),
  });

  fastify.route({
    method: "POST",
    url: `${baseUrl}/anonymous/token`,
    handler: documentsController.getAnonymousToken.bind(documentsController),
  });

  return next();
};

export default routes;
