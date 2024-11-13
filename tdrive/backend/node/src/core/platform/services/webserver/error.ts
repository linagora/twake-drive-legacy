import { FastifyInstance } from "fastify";
import { logger } from "../../framework/logger";

function serverErrorHandler(server: FastifyInstance): void {
  server.setErrorHandler(async (err, request, reply) => {
    logger.error(`Got ${reply.statusCode} error on request ${request.id} : `, err);
    server.log.debug(`Got ${reply.statusCode} error on request ${request.id} : ${err.toString()}`);
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
