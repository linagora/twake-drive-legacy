import type { FastifyInstance, FastifyPluginCallback, FastifyReply, FastifyRequest } from "fastify";
import { getConfig } from "../../../framework/api/admin";
import gr from "../../../../../services/global-resolver";
import { CrudException } from "../../../framework/api/crud-service";
import { UpdateUser } from "../../../../../services/user/services/users/types";

const config = getConfig();

function authenticateAdminQuery(request: FastifyRequest, reply: FastifyReply) {
  const secret = request.headers["secret"];
  if (secret !== config.endpointSecret) {
    reply.status(403).send();
    return false;
  }
  return true;
}

const routes: FastifyPluginCallback = async (fastify: FastifyInstance, _opts, next) => {
  const urlRoot = "/api/user/update";
  const config = getConfig();
  if (config?.endpointSecret?.length) {
    fastify.put(`${urlRoot}/:id`, async (request, reply) => {
      try {
        if (!authenticateAdminQuery(request, reply)) {
          throw CrudException.unauthorized("Not allow to update user");
        }

        return await gr.services.users.update(request.params["id"], request.body as UpdateUser);
      } catch (error) {
        return error;
      }
    });
  }
  next();
};

export default routes;
