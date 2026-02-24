import { FastifyInstance, FastifyPluginCallback } from "fastify";
import _ from "lodash";
import { languages } from "../languages";
import { Languages, ServerConfiguration } from "../types";
import version from "../../../version";
import config from "config";
import { isReadOnly } from "../../../utils/read-only";

const routes: FastifyPluginCallback<{ configuration: ServerConfiguration["configuration"] }> = (
  fastify: FastifyInstance,
  options,
  next,
) => {
  fastify.route({
    method: "GET",
    url: "/server",
    handler: async (): Promise<ServerConfiguration> => {
      const accounts = options.configuration.accounts;
      return {
        status: "ready",
        version: version,
        configuration: {
          ..._.pick(
            options.configuration,
            "help_url",
            "pricing_plan_url",
            "mobile",
            "app_download_url",
          ),
          app_grid: config.get("applications.grid") || [],
          accounts: {
            type: accounts.type,
            remote: _.pick(
              accounts.remote,
              "authority",
              "client_id",
              "account_management_url",
              "company_subscription_url",
              "company_management_url",
              "collaborators_management_url",
            ),
            internal: _.pick(
              accounts.internal,
              "disable_account_creation",
              "disable_email_verification",
            ),
          },
          drive: {
            readOnly: isReadOnly(),
            readOnlyMessage: config.has("drive.readOnlyMessage")
              ? config.get<string>("drive.readOnlyMessage")
              : "",
          },
        },
      };
    },
  });

  fastify.route({
    method: "GET",
    url: "/locales",
    handler: async (): Promise<Languages> => {
      return languages;
    },
  });

  fastify.route({
    method: "GET",
    url: "/locales/:language",
    handler: async (): Promise<any> => {
      return {};
    },
  });

  next();
};

export default routes;
