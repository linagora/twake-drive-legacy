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

type TUserDeleteQueryBody = TQueryBody & { userId: string };
function getUserIfValidQuery(request: FastifyRequest, reply: FastifyReply) {
  if (!authenticateAdminQuery(request, reply)) return false;
  const body = request.body as TUserDeleteQueryBody;
  if (!body.userId?.length) {
    reply.status(400).send();
    return false;
  }
  return body.userId;
}

const routes: FastifyPluginCallback = async (fastify: FastifyInstance, _opts, next) => {
  const config = getConfig();
  const controller = new AdminDeleteUserController();
  if (config?.endpointSecret?.length) {
    fastify.post("/user/delete", async (request, reply) => {
      const userId = getUserIfValidQuery(request, reply);
      if (!userId) return false;
      return reply.send({ status: await controller.deleteUser(userId) });
    });

    fastify.post("/user/delete/pending", async (request, reply) => {
      if (!authenticateAdminQuery(request, reply)) return false;
      return reply.send(await controller.listUsersPendingDeletion());
    });
  }
  next();
};

export default routes;
