import {
  ConsoleCompany,
  ConsoleHookCompany,
  ConsoleHookUser,
  CreateConsoleCompany,
  CreateConsoleUser,
  CreatedConsoleCompany,
  CreatedConsoleUser,
  CreateInternalUser,
  UpdateConsoleUserRole,
  UpdatedConsoleUserRole,
} from "./types";
import User from "../user/entities/user";
import Company, { CompanySearchKey } from "../user/entities/company";

export interface ConsoleServiceClient {
  /**
   * Create a company
   *
   * @param company
   */
  createCompany(company: CreateConsoleCompany): Promise<CreatedConsoleCompany>;

  /**
   * Add user to company
   *
   * @param company
   * @param user
   * @param inviter
   */
  addUserToCompany(company: ConsoleCompany, user: CreateConsoleUser): Promise<CreatedConsoleUser>;

  /**
   * Add user to tdrive in general (for non-console version)
   *
   * @param user
   */
  addUserToTdrive(user: CreateInternalUser): Promise<User>;

  /**
   * Update user role
   *
   * @param company
   * @param user
   */
  updateUserRole(
    company: ConsoleCompany,
    user: UpdateConsoleUserRole,
  ): Promise<UpdatedConsoleUserRole>;

  updateLocalCompanyFromConsole(companyDTO: ConsoleHookCompany): Promise<Company>;

  updateLocalUserFromConsole(user: ConsoleHookUser): Promise<User>;

  removeCompanyUser(consoleUserId: string, company: Company): Promise<void>;

  removeUser(consoleUserId: string): Promise<void>;

  removeCompany(companySearchKey: CompanySearchKey): Promise<void>;

  fetchCompanyInfo(consoleCompanyCode: string): Promise<ConsoleHookCompany>;

  getUserByAccessToken(idToken: string): Promise<ConsoleHookUser>;

  updateUserSession(idToken: string): Promise<string>;

  verifyJwtSid(_sid: string): Promise<void>;

  backChannelLogout(logoutToken: string): Promise<void>;

  resendVerificationEmail(email: string): Promise<void>;
}
