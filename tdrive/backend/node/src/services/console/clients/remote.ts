import { ConsoleServiceClient } from "../client-interface";
import {
  ConsoleCompany,
  ConsoleHookCompany,
  ConsoleHookUser,
  ConsoleOptions,
  CreateConsoleCompany,
  CreateConsoleUser,
  CreatedConsoleCompany,
  CreatedConsoleUser,
  UpdateConsoleUserRole,
  UpdatedConsoleUserRole,
} from "../types";

import { OidcJwtVerifier } from "./remote-jwks-verifier";
import { CrudException } from "../../../core/platform/framework/api/crud-service";
import { logger } from "../../../core/platform/framework/logger";
import gr from "../../global-resolver";
import Company, { CompanySearchKey } from "../../user/entities/company";
import User, { getInstance } from "../../user/entities/user";
import { getInstance as getCompanyInstance } from "../../user/entities/company";
import { ConsoleServiceImpl } from "../service";
import coalesce from "../../../utils/coalesce";
import config from "config";
import { CompanyUserRole } from "src/services/user/web/types";
import Session from "../entities/session";
export class ConsoleRemoteClient implements ConsoleServiceClient {
  version: "1";

  private infos: ConsoleOptions;
  private verifier: OidcJwtVerifier;

  private rootAdmins: string[] = config.has("drive.rootAdmins")
    ? config.get("drive.rootAdmins")
    : [];

  constructor(consoleInstance: ConsoleServiceImpl) {
    this.infos = consoleInstance.consoleOptions;
    this.verifier = new OidcJwtVerifier({
      clientId: this.infos.client_id,
      issuer: this.infos.issuer?.replace(/\/+$/, ""),
      jwksUri: this.infos.jwks_uri,
      // For local deployment create a https agent that ignore self signed certificate
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      requestAgent: new (require("https").Agent)({
        rejectUnauthorized: this.infos.issuer.includes("example.com") ? false : true,
      }),
    });
  }
  fetchCompanyInfo(consoleCompanyCode: string): Promise<ConsoleHookCompany> {
    throw new Error(`Method not implemented, ${consoleCompanyCode}.`);
  }
  resendVerificationEmail(email: string): Promise<void> {
    throw new Error(`Method not implemented, ${email}.`);
  }

  private auth() {
    return {};
  }

  async addUserToCompany(
    company: ConsoleCompany,
    user: CreateConsoleUser,
  ): Promise<CreatedConsoleUser> {
    logger.info(`Method not implemented, ${company.id}, ${user.id}.`);
    return null;
  }

  async updateUserRole(
    company: ConsoleCompany,
    user: UpdateConsoleUserRole,
  ): Promise<UpdatedConsoleUserRole> {
    logger.info("Remote: updateUserRole");
    logger.info(`Method not implemented, ${company.id}, ${user.id}.`);
    return null;
  }

  async createCompany(company: CreateConsoleCompany): Promise<CreatedConsoleCompany> {
    logger.info("Remote: createCompany");
    logger.info(`Method not implemented, ${company}.`);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addUserToTdrive(user: CreateConsoleUser): Promise<User> {
    logger.info("Remote: addUserToTdrive");
    //should do noting for real console
    return Promise.resolve(undefined);
  }

  async updateLocalCompanyFromConsole(partialCompanyDTO: ConsoleHookCompany): Promise<Company> {
    logger.info(`Method not implemented, ${partialCompanyDTO}.`);
    return null;
  }

  async updateLocalUserFromConsole(userDTO: ConsoleHookUser): Promise<User> {
    logger.info("Remote: updateLocalUserFromConsole");

    if (!userDTO) {
      throw CrudException.badRequest("User not found on Console");
    }

    if (userDTO.roles) {
      const roles = userDTO.roles.filter(
        role => role.applications === undefined || role.applications.find(a => a.code === "tdrive"),
      );
      //REMOVE LATER
      logger.info(`Roles are: ${roles}.`);
    }

    let user = await gr.services.users.getByConsoleId(userDTO.email || userDTO._id);

    if (!user) {
      if (!userDTO.email) {
        // if the id is an email, use it as email
        if (userDTO._id.includes("@")) {
          userDTO.email = userDTO._id;
        } else {
          throw CrudException.badRequest(`Email is required: ${JSON.stringify(userDTO)}`);
        }
      }

      let username = userDTO.email
        .split("@")[0]
        .toLocaleLowerCase()
        .replace(/[^a-zA-Z0-9]/g, "")
        .replace(/ +/g, "_");

      if (await gr.services.users.isEmailAlreadyInUse(userDTO.email)) {
        throw CrudException.badRequest("Console user not created because email already exists");
      }

      username = await gr.services.users.getAvailableUsername(username);
      if (!username) {
        throw CrudException.badRequest("Console user not created because username already exists");
      }

      user = getInstance({});
      user.username_canonical = (username || "").toLocaleLowerCase();
      user.email_canonical = userDTO.email;
      user.deleted = false;
    }

    user.email_canonical = coalesce(userDTO.email, user.email_canonical);
    user.phone = "";
    user.first_name = coalesce(userDTO.name, user.first_name);
    user.last_name = coalesce(userDTO.surname, user.last_name);
    user.identity_provider = "console";
    user.identity_provider_id = userDTO.email;
    user.mail_verified = coalesce(userDTO.isVerified, user.mail_verified);
    if (userDTO.preference) {
      user.preferences = user.preferences || {};
      user.preferences.allow_tracking = coalesce(
        userDTO.preference.allowTrackingPersonalInfo,
        user.preferences?.allow_tracking,
      );
      if (!user.preferences.language) {
        user.preferences.language = coalesce(userDTO.preference.locale, user.preferences?.language);
      }
      user.preferences.timezone = coalesce(userDTO.preference.timeZone, user.preferences?.timezone);
    }

    if (userDTO.avatar) {
      user.picture = userDTO.avatar.value;
    }

    await gr.services.users.save(user);

    //For now TDrive works with only one company as we don't get it from the SSO
    let company = await gr.services.companies.getCompany({
      id: "00000000-0000-4000-0000-000000000000",
    });
    if (!company) {
      company = await gr.services.companies.createCompany(
        getCompanyInstance({
          id: "00000000-0000-4000-0000-000000000000",
          name: "Tdrive",
          plan: { name: "Local", limits: undefined, features: undefined },
        }),
      );
    }

    let userRole: CompanyUserRole = "member";
    if (this.rootAdmins.includes(userDTO.email)) {
      userRole = "admin";
    }

    await gr.services.companies.setUserRole(company.id, user.id, userRole);

    await gr.services.users.save(user, { user: { id: user.id, server_request: true } });

    return user;
  }

  async removeCompanyUser(consoleUserId: string, company: Company): Promise<void> {
    logger.info("Remote: removeCompanyUser");

    const user = await gr.services.users.getByConsoleId(consoleUserId);
    if (!user) {
      throw CrudException.notFound(`User ${consoleUserId} doesn't exists`);
    }
    await gr.services.companies.removeUserFromCompany({ id: company.id }, { id: user.id });
  }

  async removeUser(consoleUserId: string): Promise<void> {
    logger.info("Remote: removeUser");

    const user = await gr.services.users.getByConsoleId(consoleUserId);

    if (!user) {
      throw new Error("User does not exists on Tdrive.");
    }

    await gr.services.users.anonymizeAndDelete(
      { id: user.id },
      {
        user: { id: user.id, server_request: true },
      },
    );
  }

  async removeCompany(companySearchKey: CompanySearchKey): Promise<void> {
    logger.info("Remote: removeCompany");
    await gr.services.companies.removeCompany(companySearchKey);
  }

  async getUserByAccessToken(idToken: string): Promise<ConsoleHookUser> {
    const user = (await this.verifier.verifyIdToken(idToken, this.infos.client_id))?.claims as {
      sub: string;
      email: string;
      family_name: string;
      given_name: string;
      name: string;
      locale?: string;
      picture?: string;
    };
    logger.info(`User from getUserByAccessToken is ${JSON.stringify(user)} for token ${idToken}`);
    return {
      _id: user.sub,
      roles: [] as any,
      email: user.email,
      name: user?.given_name,
      surname: user?.family_name,
      isVerified: true,
      preference: {
        locale: user?.locale,
        timeZone: 0,
        allowTrackingPersonalInfo: true,
      },
      avatar: {
        type: "url",
        value: user?.picture,
      },
    };
  }

  async updateUserSession(idToken: string): Promise<string> {
    const sessionInfo = (await this.verifier.verifyIdToken(idToken, this.infos.client_id))?.claims;
    // make sure sid claim is present in the token and not empty
    if (sessionInfo.sid) {
      const sessionRepository = gr.services.console.getSessionRepo();

      // check for existing session
      const existingSession = await sessionRepository.findOne({
        sid: sessionInfo.sid,
      });
      if (existingSession) {
        if (existingSession.revoked_at) {
          throw CrudException.unauthorized(`Session ${sessionInfo.sid} expired`);
        }
        return existingSession.sid;
      } else {
        const sessionBody = new Session();
        sessionBody.sub = sessionInfo.sub;
        sessionBody.sid = sessionInfo.sid;
        await sessionRepository.save(sessionBody);
        return sessionBody.sid;
      }
    } else {
      throw new CrudException("Missing sid claim", 400);
    }
  }

  async backChannelLogout(logoutToken: string): Promise<void> {
    const payload = await this.verifier.verifyLogoutToken(logoutToken);

    if (!payload.claims) {
      throw new CrudException("Claims are missing in the jwt", 400);
    }

    if (!payload.claims.iss) {
      throw new CrudException("Missing required 'iss' claim", 400);
    }

    if (!payload.claims.aud) {
      throw new CrudException("Missing required 'aud' claim", 400);
    }

    if (!payload.claims.iat) {
      throw new CrudException("Missing required 'iat' claim", 400);
    }

    if (!payload.claims.jti) {
      throw new CrudException("Missing required 'jti' claim", 400);
    }

    if (!payload.claims.events) {
      throw new CrudException("Missing required 'events' claim", 400);
    }

    if (payload.claims.nonce) {
      throw new CrudException("Nonce claim is prohibited", 400);
    }

    if (!payload.claims.sub) {
      throw new CrudException("Missing 'sub' claim", 400);
    }

    if (!payload.claims.sid) {
      throw new CrudException("Missing 'sid' claim", 400);
    }

    const sessionRepository = gr.services.console.getSessionRepo();
    const session = await sessionRepository.findOne({ sid: payload.claims.sid });
    if (session) {
      session.revoked_at = new Date().getTime();
      await sessionRepository.save(session);
    }
  }

  async verifyJwtSid(sid: string): Promise<void> {
    const sessionRepository = gr.services.console.getSessionRepo();
    if (sid) {
      const session = await sessionRepository.findOne({
        sid,
      });
      if (!session) {
        // fail for not matching session id
        throw new Error(`Session ${sid} not found`);
      } else if (session.revoked_at > 0) {
        throw new Error(`Session ${sid} revoked`);
      }
    } else {
      // fail for missing session id
      throw new Error("Missing session id");
    }
  }
}
