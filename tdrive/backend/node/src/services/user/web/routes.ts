import { FastifyInstance, FastifyPluginCallback } from "fastify";
import { UsersCrudController } from "./controller";
import {
  deleteDeviceSchema,
  getCompanySchema,
  getDevicesSchema,
  getQuotaSchema,
  getUserCompaniesSchema,
  getUserSchema,
  getUsersSchema,
  postDevicesSchema,
  setUserPreferencesSchema,
} from "./schemas";

const usersUrl = "/users";

const routes: FastifyPluginCallback = (fastify: FastifyInstance, options, next) => {
  const usersController = new UsersCrudController();
  const accessControl = async () => {
    // TODO: Handle Access Control
    const authorized = true;

    if (!authorized) {
      throw fastify.httpErrors.badRequest("Invalid company/workspace");
    }
  };

  fastify.route({
    method: "GET",
    url: `${usersUrl}/:id`,
    preHandler: accessControl,
    preValidation: [fastify.authenticate],
    schema: getUserSchema,
    handler: usersController.get.bind(usersController),
  });

  fastify.route({
    method: "GET",
    url: `${usersUrl}/:id/quota`,
    preHandler: accessControl,
    preValidation: fastify.authenticate,
    schema: getQuotaSchema,
    handler: usersController.qouta.bind(usersController),
  });

  fastify.route({
    method: "POST",
    url: `${usersUrl}/me/preferences`,
    preHandler: accessControl,
    preValidation: [fastify.authenticate],
    schema: setUserPreferencesSchema,
    handler: usersController.setPreferences.bind(usersController),
  });

  fastify.route({
    method: "POST",
    url: `${usersUrl}/me`,
    preHandler: accessControl,
    preValidation: [fastify.authenticate],
    schema: setUserPreferencesSchema,
    handler: usersController.save.bind(usersController),
  });

  fastify.route({
    method: "GET",
    url: `${usersUrl}`,
    preHandler: accessControl,
    preValidation: [fastify.authenticate],
    schema: getUsersSchema,
    handler: usersController.list.bind(usersController),
  });

  fastify.route({
    method: "POST",
    url: `${usersUrl}/:companyId/all`,
    preHandler: accessControl,
    preValidation: [fastify.authenticate],
    schema: getUsersSchema,
    handler: usersController.all.bind(usersController),
  });

  // Get a list of companies for a user, only common companies with current user are returned.
  fastify.route({
    method: "GET",
    url: `${usersUrl}/:id/companies`,
    preHandler: accessControl,
    preValidation: [fastify.authenticate],
    schema: getUserCompaniesSchema, //Fixme currently not working because we don't know features in advances and so it doesn't pass
    handler: usersController.getUserCompanies.bind(usersController),
  });

  //Get a company by id and public information (this route is public and doesn't need to be authenticated)
  fastify.route({
    method: "GET",
    url: "/companies/:id",
    preValidation: [fastify.authenticateOptional],
    schema: getCompanySchema, //Fixme currently not working because we don't know features in advances and so it doesn't pass
    handler: usersController.getCompany.bind(usersController),
  });

  fastify.route({
    method: "POST",
    url: "/devices",
    preHandler: accessControl,
    preValidation: [fastify.authenticate],
    schema: postDevicesSchema,
    handler: usersController.registerUserDevice.bind(usersController),
  });

  fastify.route({
    method: "GET",
    url: "/devices",
    preHandler: accessControl,
    preValidation: [fastify.authenticate],
    schema: getDevicesSchema,
    handler: usersController.getRegisteredDevices.bind(usersController),
  });

  fastify.route({
    method: "DELETE",
    url: "/devices/:value",
    preHandler: accessControl,
    preValidation: [fastify.authenticate],
    schema: deleteDeviceSchema,
    handler: usersController.deregisterUserDevice.bind(usersController),
  });

  // recent users the current user has interacted with
  fastify.route({
    method: "GET",
    url: "/companies/:id/users/recent",
    preValidation: [fastify.authenticateOptional],
    handler: usersController.recent.bind(usersController),
  });

  next();
};

export default routes;
