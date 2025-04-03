import type { FastifyInstance, FastifyRegisterOptions } from "fastify";
import deleteUserRoutes from "./delete-user-routes";
import updateUserRoutes from "./update-user-routes";

export default (
  fastify: FastifyInstance,
  opts: FastifyRegisterOptions<{ prefix: string }>,
): void => {
  fastify.register(deleteUserRoutes, opts);
  fastify.register(updateUserRoutes, opts);
};
