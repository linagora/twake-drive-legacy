import type { FastifyInstance, FastifyRegisterOptions } from "fastify";
import deleteUserRoutes from "./delete-user-routes";

export default (
  fastify: FastifyInstance,
  opts: FastifyRegisterOptions<{ prefix: string }>,
): void => {
  fastify.register(deleteUserRoutes, opts);
};
