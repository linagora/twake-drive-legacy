import { Observable } from "rxjs";
import Company from "../user/entities/company";
import CompanyUser from "../user/entities/company_user";
import { CompanyUserRole } from "../user/web/types";
import { ExecutionContext } from "../../core/platform/framework/api/crud-service";
import { AccessToken } from "../../utils/types";

export interface CreateConsoleCompany {
  code: string;
  displayName: string;
  avatar: {
    type: "url";
    value: string;
  };
  country?: string;
  address?: string;
  logo?: string;
  status: string;
  domain?: string[];
  applications?: string[];
  planId?: string;
  limits?: {
    members?: number; //Old console version
    guests?: number; //Old console version
    tdrive: {
      members: number;
      guests: number;
      storage: number;
    };
  };
}

export type CreatedConsoleCompany = Partial<CreateConsoleCompany>;

export interface CreateConsoleUser {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  avatar: {
    type: "url";
    value: string;
  };
  password: string;
  role: CompanyUserRole;
  skipInvite: boolean;
  inviterEmail: string;
}

export interface CreateInternalUser {
  email: string;
  password: string;
}

export type CreatedConsoleUser = Partial<CreateConsoleUser> & { _id: string };

export type UpdateConsoleUserRole = Pick<CreateConsoleUser, "role"> & { id: string };

export type UpdatedConsoleUserRole = UpdateConsoleUserRole;

export type ConsoleUser = {
  id: string;
  companyCode: string;
};

export type ConsoleCompany = {
  id?: string;
  code: string;
};

export type CompanyCreatedStreamObject = {
  source: Company;
  destination: ConsoleCompany;
  // Creation error
  error?: Error;
};

export type UserCreatedStreamObject = {
  source: {
    user: CompanyUser;
    company: Company;
  };
  destination: ConsoleUser;
  // Creation error
  error?: Error;
};

type ReportStatus = "success" | "failure";

export type CompanyReport = {
  sourceId: string;
  destinationCode: string;
  status: ReportStatus;
  company: CompanyCreatedStreamObject;
  error?: Error;
};

export type UserReport = {
  sourceId: string;
  destinationId: string;
  destinationCompanyCode: string;
  status: ReportStatus;
  user: UserCreatedStreamObject;
  error?: Error;
};

export type MergeProgress = Observable<ProcessReport>;

export type ProcessReport = {
  type:
    | "user:updated"
    | "user:updating"
    | "user:created"
    | "user:error"
    | "company:created"
    | "processing:owner"
    | "log"
    | "company:withoutadmin";
  //error?: Error;
  message?: string;
  data?: UserReport | CompanyReport | Error | Company[];
};

export type ConsoleType = "remote" | "internal";

export type ConsoleOptions = {
  type: ConsoleType;
  authority: string;
  client_id: string;
  client_secret: string;
  issuer: string;
  jwks_uri: string;
  audience: string;
  redirect_uris: string[];
  disable_account_creation: boolean;
};

export type ConsoleHookCompany = {
  stats: string;
  limits: {
    members?: number; //Old console version
    guests?: number; //Old console version
    tdrive: {
      members: number;
      guests: number;
      storage: number;
    };
  };
  value: string;
  details: {
    code: string;
    logo: string;
    avatar: {
      value: string;
      type: string;
    };
    name: string;
    country: string;
    address: string;
  };
};

export type ConsoleHookUser = {
  _id: string;
  roles: [
    {
      targetCode: string;
      roleCode: CompanyUserRole;
      status: "active" | "deactivated";
      applications: {
        code: "tdrive";
      }[];
    },
  ];
  email: string;
  name: string;
  surname: string;
  isVerified: boolean;
  preference: {
    locale: string;
    timeZone: number;
    allowTrackingPersonalInfo: boolean;
  };
  avatar: {
    type: string;
    value: string;
  };
};

export type ConsoleHookBodyContent = {
  company: ConsoleHookCompany;
  user: ConsoleHookUser;
};

export type ConsoleHookCompanyDeletedContent = {
  companyCode: string;
};

export type ConsoleHookPreferenceContent = {
  preference: {
    targetCode: string;
  };
};

export type ConsoleHookBody = {
  type: string;
  content:
    | ConsoleHookBodyContent
    | ConsoleHookUser
    | ConsoleHookCompany
    | ConsoleHookCompanyDeletedContent;
  signature: string;
  secret_key?: string;
};

export class ConsoleHookQueryString {
  secret_key: string;
}

export class ConsoleHookResponse {
  success?: boolean;
  error?: string;
}

export interface ConsoleExecutionContext extends ExecutionContext {
  options: ConsoleOptions;
}

export interface AuthRequest {
  email?: string;
  password?: string;
  oidc_id_token?: string;
}

export interface AuthResponse {
  access_token?: AccessToken;
  error?: string;
}

export type ConsoleBackchannelLogoutRequest = {
  logout_token: string;
};
