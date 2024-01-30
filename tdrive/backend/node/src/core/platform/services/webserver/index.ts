import { logger, TdriveService } from "../../framework";
import { Server, IncomingMessage, ServerResponse } from "http";
import { FastifyInstance, fastify } from "fastify";
import sensible from "fastify-sensible";
import multipart from "fastify-multipart";
import formbody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";
import corsPlugin, { FastifyCorsOptions } from "fastify-cors";
import { serverErrorHandler } from "./error";
import WebServerAPI from "./provider";
import jwtPlugin from "../auth/web/jwt";
import path from "path";
import swaggerPlugin from "fastify-swagger";
import { SkipCLI } from "../../framework/decorators/skip";
import fs from "fs";
import { ExecutionContext, executionStorage } from "../../framework/execution-storage";

// import { throws } from "assert";
export default class WebServerService extends TdriveService<WebServerAPI> implements WebServerAPI {
  name = "webserver";
  version = "1";
  private server: FastifyInstance<Server, IncomingMessage, ServerResponse>;
  // eslint-disable-next-line @typescript-eslint/ban-types
  private onReadyHandlers: Function[] = [];

  getServer(): FastifyInstance {
    return this.server;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  onReady(handler: Function): void {
    this.onReadyHandlers.push(handler);
  }

  api(): WebServerAPI {
    return this;
  }

  async doInit(): Promise<this> {
    // TODO: Get server config from options
    this.server = fastify({
      maxParamLength: 300, //We have big urls with uuids and devices tokens
      logger: false,
    });

    this.server.addHook("onRequest", (req, res, done) => {
      const defaultStoreValues = { request_id: req.id } as ExecutionContext;
      executionStorage.run(defaultStoreValues, done);
    });

    this.server.addHook("onResponse", (req, reply, done) => {
      logger.info(`${reply.raw.statusCode} ${req.raw.method} ${req.raw.url}`);
      done();
    });

    this.server.addHook("onError", (request, reply, error, done) => {
      logger.error(error);
      done();
    });

    this.server.addHook("preValidation", (request, reply, done) => {
      if (reply.statusCode === 500) {
        logger.error("An error occured with the preValidation of ", request.routerPath);
      }
      done();
    });

    this.server.addHook("preHandler", (request, reply, done) => {
      reply.header("Cache-Control", "no-cache");
      if (reply.statusCode === 500) {
        logger.error("An error occured with the preHandler of ", request.routerPath);
      }
      done();
    });

    serverErrorHandler(this.server);
    // DIRTY HACK: THis needs to be registered here to avoid circular dep between auth and user.
    // will have to create a core service for this, or another service which must be started first...
    this.server.register(swaggerPlugin, {
      routePrefix: "/internal/docs",
      swagger: {
        info: {
          title: "Tdrive Swagger",
          description: "Automatically generate Tdrive Swagger API",
          version: "0.1.0",
        },
        externalDocs: {
          url: "http://linagora.github.io/Tdrive",
          description: "Find more info here",
        },
        host: "localhost",
        schemes: ["http"],
        consumes: ["application/json"],
        produces: ["application/json"],
        tags: [],
        definitions: {},
        securityDefinitions: {},
      },
      uiConfig: {
        docExpansion: "full",
        deepLinking: false,
      },
      staticCSP: false,
      transformStaticCSP: header => header,
      exposeRoute: true,
    });
    this.server.register(jwtPlugin);
    this.server.register(sensible, { errorHandler: false });
    this.server.register(multipart);
    this.server.register(formbody);
    this.server.register(corsPlugin, this.configuration.get<FastifyCorsOptions>("cors", {}));

    return this;
  }

  @SkipCLI()
  async doStart(): Promise<this> {
    try {
      let root = this.configuration.get<{ root: string }>("static", { root: "./public" }).root;
      root = root.indexOf("/") === 0 ? root : path.join(__dirname + "/../../../../../", root);
      this.server.register(fastifyStatic, {
        root,
      });
      this.server.setNotFoundHandler((req, res) => {
        if (
          req.raw.url &&
          (req.raw.url.startsWith("/internal") ||
            req.raw.url.startsWith("/api") ||
            req.raw.url.startsWith("/plugins") ||
            req.raw.url.startsWith("/admin"))
        ) {
          return res.status(404).send({
            error: "Not found",
          });
        }

        const path = root.replace(/\/$/, "") + "/index.html";
        const stream = fs.createReadStream(path);
        res.type("text/html").send(stream);
      });

      await this.server.listen(this.configuration.get<number>("port", 3000), "0.0.0.0");

      this.server.ready(err => {
        if (err) throw err;
        this.server.swagger();

        this.onReadyHandlers.forEach(handler => {
          handler(err);
        });
      });

      return this;
    } catch (err) {
      this.server.log.error(err);
      throw err;
    }
  }

  async doStop(): Promise<this> {
    await this.server.close();

    return this;
  }
}
