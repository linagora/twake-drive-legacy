import config from "../../../config";

interface IAdminConfig {
  // This secret must be provided to the administration endpoints
  endpointSecret?: string;
}

export const getConfig = (): IAdminConfig => {
  const configSection = config.get("admin") as IAdminConfig;
  return {
    ...configSection,
  };
};
