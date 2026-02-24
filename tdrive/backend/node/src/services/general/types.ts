export type Languages = {
  default: string;
  availables: string[];
};

export type ServerConfiguration = {
  status: "ready";
  version: {
    current: string;
    minimal: {
      web: string;
      mobile: string;
    };
  };
  configuration: {
    help_url: string | null;
    pricing_plan_url: string | null;
    app_download_url: string | null;
    app_grid: { logo: string; name: string; url: string }[];
    mobile: {
      mobile_redirect: string;
      mobile_appstore: string;
      mobile_googleplay: string;
    };
    accounts: {
      type: "remote" | "internal";
      remote: null | {
        authority: string;
        client_id: string;
        account_management_url: string;
        company_management_url: string;
        company_subscription_url: string;
        collaborators_management_url: string;
      };
      internal: null | {
        disable_account_creation: boolean;
        disable_email_verification: boolean;
      };
    };
    drive: {
      readOnly: boolean;
      readOnlyMessage: string;
    };
  };
};
