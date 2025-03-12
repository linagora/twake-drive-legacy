import { FastifyInstance } from "fastify";
import { logger } from "../../framework/logger";
import { CrudException } from "../../framework/api/crud-service";

function serverErrorHandler(server: FastifyInstance): void {
  server.setErrorHandler(async (err, request, reply) => {
    if (reply.statusCode == 200 || !reply.statusCode) {
      const status = err.statusCode || (err as any).status;
      reply.status(status < 400 ? 500 : status);
    }
    logger.error(
      err instanceof CrudException
        ? {
            type: "CrudException",
            message: err.message,
          }
        : { err },
      `Got ${reply.statusCode} error on request ${request.id} : ${err.toString()}`,
    );
    await reply.send(
      reply.statusCode == 500
        ? {
            statusCode: reply.statusCode,
            error: "Internal Server Error",
            message: "Something went wrong, " + err.message,
            requestId: request.id,
          }
        : err,
    );
  });
}

export { serverErrorHandler };
