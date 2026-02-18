import { FastifyReply, FastifyRequest } from "fastify";
import config from "config";
import { logger } from "../core/platform/framework";

/**
 * Check if drive is in read-only mode
 */
export function isReadOnly(): boolean {
  if (!config.has("drive.readOnly")) {
    return false;
  }
  const value = config.get<boolean | string>("drive.readOnly");
  // Handle both boolean and string values from environment variables
  return value === true || value === "true";
}

/**
 * Fastify preHandler hook that blocks write operations when read-only mode is enabled.
 * Use this hook on POST, PUT, PATCH, DELETE routes that modify files or documents.
 */
export async function readOnlyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (isReadOnly()) {
    logger.warn(`Read-only mode: blocked ${request.method} ${request.url}`);
    reply.code(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: "Drive is in read-only mode. Write operation s are not allowed.",
    });
  }
}
