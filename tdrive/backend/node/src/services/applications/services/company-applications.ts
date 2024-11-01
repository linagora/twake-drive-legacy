import { Initializable, logger, TdriveServiceProvider } from "../../../core/platform/framework";
import { ListResult, Paginable } from "../../../core/platform/framework/api/crud-service";
import gr from "../../global-resolver";
import {
  CompanyApplicationPrimaryKey,
  CompanyApplicationWithApplication,
} from "../entities/company-application";
import { CompanyExecutionContext } from "../web/types";

export class CompanyApplicationServiceImpl implements TdriveServiceProvider, Initializable {
  version: "1";

  async init(): Promise<this> {
    return this;
  }

  async get(
    pk: Pick<CompanyApplicationPrimaryKey, "company_id" | "application_id"> & { id?: string },
    context?: CompanyExecutionContext,
  ): Promise<CompanyApplicationWithApplication> {
    try {
      const application = await gr.services.applications.marketplaceApps.get(
        pk.application_id,
        context,
      );

      if (!application?.id) {
        return null;
      }

      const app = {
        ...{
          id: pk.application_id,
          company_id: pk.company_id,
          application_id: pk.application_id,
        },
        application: { ...application },
      };
      app.application.api = null;
      return app;
    } catch (err) {
      logger.error(err);
      return null;
    }
  }

  async list<ListOptions>(
    _pagination: Paginable,
    _options?: ListOptions,
    context?: CompanyExecutionContext,
  ): Promise<ListResult<CompanyApplicationWithApplication>> {
    const companyApplications = (await gr.services.applications.marketplaceApps.list(context)).map(
      app => ({
        id: app.id,
        company_id: context.company.id,
        application_id: app.id,
      }),
    );

    const applications = [];

    for (const companyApplication of companyApplications) {
      const application = await gr.services.applications.marketplaceApps.get(
        companyApplication.application_id,
        context,
      );
      if (application) {
        const app = {
          ...companyApplication,
          application: { ...application },
        };
        app.application.api = null;
        applications.push(app);
      }
    }

    return new ListResult<CompanyApplicationWithApplication>("applications", applications, null);
  }
}
