import config from "config";

export const getConfigOrDefault = <T>(key: string, defaultValue: T): T => {
  const value = config.has(key) ? config.get(key) : defaultValue;

  // Handle specific cases for boolean
  if (typeof defaultValue === "boolean") {
    return (value === "true" || value === true) as T;
  }

  return value as T;
};
