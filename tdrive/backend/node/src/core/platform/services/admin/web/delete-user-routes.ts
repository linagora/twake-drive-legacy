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

type TUserDeleteQueryBody = TQueryBody & { userId: string; deleteData: boolean; username?: string };
function getUserIfValidQuery(request: FastifyRequest, reply: FastifyReply) {
  if (!authenticateAdminQuery(request, reply)) return { userId: "", deleteData: false };
  const body = request.body as TUserDeleteQueryBody;
  if (!body.userId?.length && !body.username) {
    reply.status(400).send();
    return { userId: "", username: "", deleteData: false };
  }
  return {
    userId: body.userId || "",
    username: body.username,
    deleteData: body.deleteData,
  };
}

type TUserGetIdByUsernameBody = TQueryBody & { username: string };

const routes: FastifyPluginCallback = async (fastify: FastifyInstance, _opts, next) => {
  const urlRoot = "/api/user/delete";
  const config = getConfig();
  const controller = new AdminDeleteUserController();
  if (config?.endpointSecret?.length) {
    fastify.post(urlRoot, async (request, reply) => {
      const { userId, deleteData, username } = getUserIfValidQuery(request, reply);
      if (!userId && !username) return false;
      if (userId == "e2e_simulate_timeout")
        return new Promise(() => {
          return;
        });
      return await controller.deleteUser(userId, deleteData, username);
    });

    fastify.post(`${urlRoot}/pending`, async (request, reply) => {
      if (!authenticateAdminQuery(request, reply)) return false;
      return await controller.listUsersPendingDeletion();
    });

    fastify.post("/api/user-id", async (request, reply) => {
      if (!authenticateAdminQuery(request, reply)) return false;

      const { username } = request.body as TUserGetIdByUsernameBody;
      const userId = await controller.getUserIdByUsername(username);

      if (!userId) {
        return reply.status(404).send({ message: "User not found" });
      }

      return { id: userId };
    });
  }
  next();
};

export default routes;
