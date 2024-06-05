import axios from "axios";
import config from "config";
import _ from "lodash";
import { Prefix, TdriveService } from "../../core/platform/framework";
import WebServerAPI from "../../core/platform/services/webserver/provider";
import Application from "../applications/entities/application";
import web from "./web/index";
import { logger } from "../../core/platform/framework/logger";

@Prefix("/api")
export default class ApplicationsApiService extends TdriveService<undefined> {
  version = "1";
  name = "applicationsapi";

  public async doInit(): Promise<this> {
    const fastify = this.context.getProvider<WebServerAPI>("webserver").getServer();
    fastify.register((instance, _opts, next) => {
      web(instance, { prefix: this.prefix });
      next();
    });

    //Redirect requests from /plugins/* to the plugin server (if installed)
    const apps = config.get<Application[]>("applications.plugins") || [];
    for (const app of apps) {
      const domain = app.internal_domain.replace(/(\/$|^\/)/gm, "");
      const prefix = app.external_prefix.replace(/(\/$|^\/)/gm, "");
      if (domain && prefix) {
        try {
          fastify.all("/" + prefix + "/*", async (req, rep) => {
            logger.info(`Proxying ${req.method} ${req.url} to ${domain}`);
            try {
              const response = await axios.request({
                url: domain + req.url,
                method: req.method as any,
                headers: _.omit(req.headers, "host", "content-length") as {
                  [key: string]: string;
                },
                data: req.body as any,
                responseType: "stream",
                maxRedirects: 0,
                validateStatus: null,
              });

              // Headers
              for (const key in response.headers) {
                rep.header(key, response.headers[key]);
              }
              rep.statusCode = response.status;

              // Redirects
              if (response.status === 301 || response.status === 302) {
                rep.redirect(response.headers.location);
                return;
              }

              await rep.send(response.data);
            } catch (err) {
              logger.error(err);
              if (err.errors) err.errors.forEach(err => logger.error(err));
              rep.raw.statusCode = 500;
              rep.raw.end(JSON.stringify({ error: err.message }));
            }
          });
          logger.info("Listening at /" + prefix + "/*");
        } catch (e) {
          logger.error(e);
          logger.info("Can't listen to /" + prefix + "/*");
        }
      }
    }

    return this;
  }

  // TODO: remove
  api(): undefined {
    return undefined;
  }
}
