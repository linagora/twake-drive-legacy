import config from "config";

export const getConfigOrDefault = (key: string, defaultValue: any) => {
  return config.has(key) ? config.get(key) : defaultValue;
};
