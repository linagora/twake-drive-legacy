import { FastifyInstance, FastifyPluginCallback, FastifyRequest } from "fastify";
import { authenticationSchema, consoleHookSchema, tokenRenewalSchema } from "./schemas";
// import { WorkspaceBaseRequest, WorkspaceUsersBaseRequest, WorkspaceUsersRequest } from "./types";
import { ConsoleController } from "./controller";
import { ConsoleHookBody, ConsoleHookQueryString } from "../types";

const hookUrl = "/hook";

const routes: FastifyPluginCallback = (fastify: FastifyInstance, options, next) => {
  const controller = new ConsoleController();

  const accessControl = async (
    request: FastifyRequest<{ Body: ConsoleHookBody; Querystring: ConsoleHookQueryString }>,
  ) => {
    throw fastify.httpErrors.notImplemented(`Hook service doesn't exist anymore, ${request}.`);
  };

  fastify.route({
    method: "POST",
    url: `${hookUrl}`,
    preHandler: [accessControl],
    schema: consoleHookSchema,
    handler: controller.hook.bind(controller),
  });

  fastify.route({
    method: "POST",
    url: "/login",
    schema: authenticationSchema,
    handler: controller.auth.bind(controller),
  });

  fastify.route({
    method: "POST",
    url: "/signup",
    handler: controller.signup.bind(controller),
  });

  fastify.route({
    method: "POST",
    url: "/token",
    preValidation: [fastify.authenticate],
    schema: tokenRenewalSchema,
    handler: controller.tokenRenewal.bind(controller),
  });

  fastify.route({
    method: "POST",
    url: "/resend-verification-email",
    preValidation: [fastify.authenticate],
    handler: controller.resendVerificationEmail.bind(controller),
  });

  fastify.route({
    method: "POST",
    url: "/backchannel_logout",
    handler: controller.backChannelLogout.bind(controller),
  });

  next();
};

export default routes;
