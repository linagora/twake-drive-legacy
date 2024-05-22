import { FastifyPluginCallback, FastifyRequest } from "fastify";
import fastifyJwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import fp from "fastify-plugin";
import config from "../../../../config";
import { JwtType } from "../../types";
import { executionStorage } from "../../../framework/execution-storage";
import gr from "../../../../../services/global-resolver";

const jwtPlugin: FastifyPluginCallback = async (fastify, _opts, next) => {
  fastify.register(cookie);
  fastify.register(fastifyJwt, {
    secret: config.get("auth.jwt.secret"),
    cookie: {
      cookieName: "X-AuthToken",
      signed: false,
    },
  });

  const authenticate = async (request: FastifyRequest) => {
    const sessionRepository = gr.services.console.getSessionRepo();

    const jwt: JwtType = await request.jwtVerify();
    if (jwt.sid) {
      const session = await sessionRepository.findOne({
        sid: jwt.sid,
      });
      if (session.sid != jwt.sid) {
        // fail for not matching session id
        throw new Error("Session id does not match");
      }
    }
    if (jwt.type === "refresh") {
      // TODO  in the future we must invalidate the refresh token (because it should be single use)
    }

    request.currentUser = {
      ...{ email: jwt.email },
      ...{ id: jwt.sub },
      ...{ sid: jwt.sid },
      ...{ identity_provider_id: jwt.provider_id },
      ...{ application_id: jwt.application_id || null },
      ...{ server_request: jwt.server_request || false },
      ...{ allow_tracking: jwt.track || false },
      ...{ public_token_document_id: jwt.public_token_document_id || null },
    };

    executionStorage.getStore().user_id = request.currentUser.id;
    executionStorage.getStore().user_email = request.currentUser.email;

    request.log.debug(`Authenticated as user ${request.currentUser.id}`);
  };

  fastify.decorate("authenticate", async (request: FastifyRequest) => {
    try {
      await authenticate(request);
    } catch (err) {
      throw fastify.httpErrors.unauthorized(`Bad credentials ${JSON.stringify(err)}`);
    }
  });

  fastify.decorate("authenticateOptional", async (request: FastifyRequest) => {
    try {
      await authenticate(request);
    } catch (err) {}
  });

  next();
};

export default fp(jwtPlugin, {
  name: "authenticate",
});
