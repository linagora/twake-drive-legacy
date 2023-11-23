import { DriveFile } from "src/services/documents/entities/drive-file";
import Company from "../../../../services/user/entities/company";
import User from "../../../../services/user/entities/user";

export type EmailBuilderDataPayload = {
  sender: User;
  receiver: User;
  company: Company;
  notifications?: {
    type: string;
    item: DriveFile;
  }[];
};

export type EmailBuilderRenderedResult = {
  html: string;
  text: string;
  subject: string;
};

export type EmailBuilderTemplateName = "notification-digest" | "notification-document";

export type EmailPusherPayload = {
  subject: string;
  html: string;
  text: string;
};

export type EmailPusherEmailType = {
  sender: string;
  html_body: string;
  text_body: string;
  to: string[];
  subject: string;
};

export type EmailPusherResponseType = {
  data: {
    succeeded: number;
    failed: number;
    failures: string[];
    error?: string;
    error_code?: string;
  };
};

export type EmailLanguageType = "en" | "fr";

export type SMTPClientConfigType = {
  host: string;
  port: number;
  secure?: boolean;
  requireTLS: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  logger?: boolean;
};
