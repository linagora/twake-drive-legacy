import type { FastifyInstance, FastifyPluginCallback } from "fastify";
import { getConfig as getDiagnosticsGetConfig } from "../../../framework/api/diagnostics";
import { getHeapSnapshotSync } from "../utils";

const routes: FastifyPluginCallback = (fastify: FastifyInstance, _opts, next) => {
  const diagnosticsConfig = getDiagnosticsGetConfig();
  if (diagnosticsConfig?.probeSecret?.length) {
    fastify.post("/heap", async (request, reply) => {
      if ((request.query as { secret: string }).secret !== diagnosticsConfig.probeSecret)
        return reply.status(403).send();
      const filenameTimestamp = new Date()
        .toISOString()
        .replace(/(\.\d\d\d)?Z$/, "")
        .replace(/\D/g, "-");
      reply.header(
        "Content-Disposition",
        `attachment; filename="twake-drive-snap-${filenameTimestamp}.heapsnapshot"`,
      );
      let replyResult;
      await getHeapSnapshotSync(readable => (replyResult = reply.send(readable)));
      return replyResult;
    });
  }
  next();
};

export default routes;
