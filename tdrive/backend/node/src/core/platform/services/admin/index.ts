import { TdriveService, Consumes, Prefix, ServiceName } from "../../framework";
import web from "./web";
import AdminServiceAPI from "./service-provider";
import AdminServiceImpl from "./service";
import WebServerAPI from "../webserver/provider";

/**
 * The admin service exposes endpoint that are of use for operational reasons to administrators only, and should not be exposed.
 */
@Prefix("/admin")
@Consumes(["webserver"])
@ServiceName("admin")
export default class AdminService extends TdriveService<AdminServiceAPI> {
  name = "admin";
  service: AdminServiceAPI;

  api(): AdminServiceAPI {
    return this.service;
  }

  public async doInit(): Promise<this> {
    this.service = new AdminServiceImpl();
    const fastify = this.context.getProvider<WebServerAPI>("webserver").getServer();

    fastify.register((instance, _opts, next) => {
      web(instance, { prefix: this.prefix });
      next();
    });

    return this;
  }

  public async doStop(): Promise<this> {
    return this;
  }
}
