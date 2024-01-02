import pino from "pino";

export type TDriveLogger = pino.Logger;

export const logger = pino({
  name: "TDriveNextCloudMigration",
  level: "debug",
  prettyPrint: false,
} as pino.LoggerOptions);
