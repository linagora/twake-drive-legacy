import type { FastifyInstance, FastifyPluginCallback, FastifyReply, FastifyRequest } from "fastify";
import { getConfig } from "../../../framework/api/admin";
import { AdminDeleteUserController } from "../controller/delete-user-controller";

const config = getConfig();

type TQueryBody = { secret: string };
function authenticateAdminQuery(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as TQueryBody;
  if (body?.secret !== config.endpointSecret) {
    reply.status(403).send();
    return false;
  }
  return true;
}

type TUserDeleteQueryBody = TQueryBody & { userId: string; deleteData: boolean };
function getUserIfValidQuery(request: FastifyRequest, reply: FastifyReply) {
  if (!authenticateAdminQuery(request, reply)) return { userId: "", deleteData: false };
  const body = request.body as TUserDeleteQueryBody;
  if (!body.userId?.length) {
    reply.status(400).send();
    return { userId: "", deleteData: false };
  }
  return body;
}

const routes: FastifyPluginCallback = async (fastify: FastifyInstance, _opts, next) => {
  const urlRoot = "/api/user/delete";
  const config = getConfig();
  const controller = new AdminDeleteUserController();
  if (config?.endpointSecret?.length) {
    fastify.post(urlRoot, async (request, reply) => {
      const { userId, deleteData } = getUserIfValidQuery(request, reply);
      if (!userId) return false;
      if (userId == "e2e_simulate_timeout")
        return new Promise(() => {
          return;
        });
      return { status: await controller.deleteUser(userId, deleteData) };
    });

    fastify.post(`${urlRoot}/pending`, async (request, reply) => {
      if (!authenticateAdminQuery(request, reply)) return false;
      return await controller.listUsersPendingDeletion();
    });
  }
  next();
};

export default routes;
