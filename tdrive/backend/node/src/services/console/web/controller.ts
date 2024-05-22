import { FastifyReply, FastifyRequest } from "fastify";
import {
  AuthRequest,
  AuthResponse,
  ConsoleHookBody,
  ConsoleHookBodyContent,
  ConsoleHookCompany,
  ConsoleHookCompanyDeletedContent,
  ConsoleHookPreferenceContent,
  ConsoleHookResponse,
  ConsoleHookUser,
  ConsoleType,
  ConsoleBackchannelLogoutRequest,
} from "../types";
import Company from "../../user/entities/company";
import { CrudException } from "../../../core/platform/framework/api/crud-service";
import PasswordEncoder from "../../../utils/password-encoder";
import { AccessToken } from "../../../utils/types";
import assert from "assert";
import { logger } from "../../../core/platform/framework";
import { getInstance } from "../../user/entities/user";
import { getInstance as getCompanyInstance } from "../../../services/user/entities/company";
import Workspace from "../../../services/workspaces/entities/workspace";
import gr from "../../global-resolver";
import { Configuration } from "../../../core/platform/framework";
import { CompanyUserRole } from "src/services/user/web/types";
import config from "config";

export class ConsoleController {
  private passwordEncoder: PasswordEncoder;
  private rootAdmins: string[] = config.has("drive.rootAdmins")
    ? config.get("drive.rootAdmins")
    : [];

  constructor() {
    this.passwordEncoder = new PasswordEncoder();
  }

  async auth(request: FastifyRequest<{ Body: AuthRequest }>): Promise<AuthResponse> {
    if (request.body.oidc_id_token) {
      return { access_token: await this.authByToken(request.body.oidc_id_token) };
    } else if (request.body.email && request.body.password) {
      return { access_token: await this.authByPassword(request.body.email, request.body.password) };
    } else {
      throw CrudException.badRequest("remote_access_token or email+password are required");
    }
  }

  async signup(
    request: FastifyRequest<{
      Body: { email: string; password: string; first_name: string; last_name: string };
    }>,
  ): Promise<AuthResponse> {
    const configuration = new Configuration("console");
    const type = configuration.get("type") as ConsoleType;

    try {
      //Allow only if no console is set up in this case everyone will be in the same company
      //Console is set up
      if (type !== "internal") {
        throw new Error("Unable to signup in console mode");
      }

      //Allow only if signup isn't disabled
      if (configuration.get("disable_account_creation")) {
        throw new Error("Account creation is disabled");
      }

      const email = request.body.email.trim().toLocaleLowerCase();
      if (await gr.services.users.getByEmail(email)) {
        throw new Error("This email is already used");
      }

      try {
        const newUser = getInstance({
          first_name: request.body.first_name,
          last_name: request.body.last_name,
          email_canonical: email,
          username_canonical: (email.replace("@", ".") || "").toLocaleLowerCase(),
        });
        let userRole: CompanyUserRole = "member";
        const user = await gr.services.users.create(newUser);
        await gr.services.users.setPassword({ id: user.entity.id }, request.body.password);

        //Create a global company for all users in local mode
        const companies = await gr.services.companies.getCompanies();
        let company = companies.getEntities()?.[0];
        if (!company) {
          const newCompany = getCompanyInstance({
            name: "Tdrive",
            plan: { name: "Local", limits: undefined, features: undefined },
          });
          company = await gr.services.companies.createCompany(newCompany);
        }
        if (this.rootAdmins.includes(email)) {
          userRole = "admin";
        }
        await gr.services.companies.setUserRole(company.id, user.entity.id, userRole);

        //In case someone invited us to a workspace
        await gr.services.workspaces.processPendingUser(user.entity);

        //If user is in no workspace, then we create one for they
        const workspaces = await gr.services.workspaces.getAllForUser(
          { userId: user.entity.id },
          { id: company.id },
        );
        if (workspaces.length === 0) {
          gr.services.workspaces.create(
            {
              company_id: company.id,
              name: `${
                newUser.first_name || newUser.last_name || newUser.username_canonical
              }'s space`,
            } as Workspace,
            { user: { id: user.entity.id } },
          );
        }

        return {
          access_token: await this.authByPassword(request.body.email, request.body.password),
        };
      } catch (err) {
        throw new Error("An unknown error occured");
      }
    } catch (err) {
      return { error: err.toString() };
    }
  }

  async tokenRenewal(request: FastifyRequest): Promise<AuthResponse> {
    return {
      access_token: gr.platformServices.auth.generateJWT(
        request.currentUser.id,
        request.currentUser.email,
        request.currentUser.sid,
        {
          track: request.currentUser?.allow_tracking || false,
          provider_id: request.currentUser.identity_provider_id,
          public_token_document_id: request.currentUser.public_token_document_id,
        },
      ),
    };
  }

  async resendVerificationEmail(
    request: FastifyRequest,
  ): Promise<{ success: boolean; email: string }> {
    const user = await gr.services.users.get({ id: request.currentUser.id });

    await gr.services.console.getClient().resendVerificationEmail(user.email_canonical);

    return {
      success: true,
      email: user.email_canonical,
    };
  }

  private async getCompanyDataFromConsole(
    company: ConsoleHookCompany | ConsoleHookCompany["details"] | { code: string },
  ): Promise<ConsoleHookCompany> {
    return gr.services.console
      .getClient()
      .fetchCompanyInfo(
        (company as ConsoleHookCompany["details"])?.code ||
          (company as ConsoleHookCompany)?.details?.code,
      );
  }

  private async updateCompany(company: ConsoleHookCompany): Promise<Company> {
    const companyDTO = await this.getCompanyDataFromConsole(company);
    return gr.services.console.getClient().updateLocalCompanyFromConsole(companyDTO);
  }

  async hook(
    request: FastifyRequest<{ Body: ConsoleHookBody }>,
    reply: FastifyReply,
  ): Promise<ConsoleHookResponse> {
    try {
      logger.info(`Received event ${request.body.type}`);

      switch (request.body.type) {
        case "user_created":
        case "company_user_added":
        case "company_user_activated":
        case "company_user_updated":
          await this.userAdded(request.body.content as ConsoleHookBodyContent);
          break;
        case "company_user_deactivated":
        case "company_user_deleted":
          await this.userDisabled(request.body.content as ConsoleHookBodyContent);
          break;
        case "user_updated":
          await this.userUpdated((request.body.content as ConsoleHookBodyContent).user._id);
          break;
        case "user_preference_updated":
          await this.userUpdated(
            (request.body.content as unknown as ConsoleHookPreferenceContent).preference.targetCode,
          );
          break;
        case "user_deleted":
          await this.userRemoved(request.body.content as ConsoleHookUser);
          break;
        case "plan_updated":
          await this.planUpdated(request.body.content as ConsoleHookBodyContent);
          break;
        case "company_deleted":
          await this.companyRemoved(request.body.content as ConsoleHookCompanyDeletedContent);
          break;
        case "company_created":
          await this.companyUpdated(request.body.content as ConsoleHookBodyContent);
          if ((request.body.content as ConsoleHookBodyContent)?.user?._id) {
            await this.userUpdated((request.body.content as ConsoleHookBodyContent).user._id);
          }
          break;
        case "company_updated":
          await this.companyUpdated(request.body.content as ConsoleHookBodyContent);
          break;
        default:
          logger.info("Event not recognized");
          throw CrudException.notImplemented("Unimplemented");
      }
    } catch (e) {
      reply.status(400);
      return {
        error: e.message,
      };
    }

    return {
      success: true,
    };
  }

  private async userAdded(content: ConsoleHookBodyContent): Promise<void> {
    const userDTO = content.user;
    const user = await gr.services.console.getClient().updateLocalUserFromConsole(userDTO);
    await this.updateCompany(content.company);
    await gr.services.console.processPendingUser(user);
  }

  private async userDisabled(content: ConsoleHookBodyContent): Promise<void> {
    const company = await this.updateCompany(content.company);
    await gr.services.console.getClient().removeCompanyUser(content.user._id, company);
  }

  private async userRemoved(content: ConsoleHookUser): Promise<void> {
    await gr.services.console.getClient().removeUser(content._id);
  }

  private async userUpdated(code: string) {
    //Not implemented yet
    throw CrudException.notImplemented(`Method not implemented, ${code}.`);
  }

  private async companyRemoved(content: ConsoleHookCompanyDeletedContent) {
    assert(content.companyCode, "content.companyCode is missing");

    await gr.services.console.getClient().removeCompany({
      identity_provider: "console",
      identity_provider_id: content.companyCode,
    });
  }

  private async companyUpdated(content: ConsoleHookBodyContent) {
    await this.updateCompany(content.company);
  }

  private async planUpdated(content: ConsoleHookBodyContent) {
    await this.updateCompany(content.company);
  }

  private async authByPassword(email: string, password: string): Promise<AccessToken> {
    const user = await gr.services.users.getByEmail(email);
    if (!user) {
      throw CrudException.forbidden("User doesn't exists");
    }

    // allow to login in development mode with any password. This can be used to test without the console provider because the password is not stored locally...
    if (process.env.NODE_ENV !== "development") {
      const [storedPassword, salt] = await gr.services.users.getHashedPassword({
        id: user.id,
      });

      if (!(await this.passwordEncoder.isPasswordValid(storedPassword, password, salt))) {
        throw CrudException.forbidden("Password doesn't match");
      }
    } else if (process.env.NODE_ENV === "development") {
      logger.warn("ERROR_NOTONPROD: YOU ARE RUNNING IN DEVELOPMENT MODE, AUTH IS DISABLED!!!");
    }

    return gr.platformServices.auth.generateJWT(user.id, user.email_canonical, "", {
      track: user?.preferences?.allow_tracking || false,
      provider_id: user.identity_provider_id,
    });
  }

  private async authByToken(idToken: string): Promise<AccessToken> {
    const client = gr.services.console.getClient();
    const userDTO = await client.getUserByAccessToken(idToken);
    const user = await client.updateLocalUserFromConsole(userDTO);

    if (!user) {
      throw CrudException.notFound(`User details not found for access token ${idToken}`);
    }

    // update the user session
    const session = await client.updateUserSession(idToken);

    return gr.platformServices.auth.generateJWT(user.id, user.email_canonical, session, {
      track: user?.preferences?.allow_tracking || false,
      provider_id: user.identity_provider_id,
    });
  }

  async backChannelLogout(
    request: FastifyRequest<{ Body: ConsoleBackchannelLogoutRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const logoutToken = request.body.logout_token;
      if (!logoutToken) {
        throw new CrudException("Missing logout_token", 400);
      }
      await gr.services.console.getClient().backChannelLogout(logoutToken);
      reply.status(200).send({ success: true });
    } catch (e) {
      logger.error(e.message);
      reply.status(400).send({ error: e.message });
    }
  }
}
