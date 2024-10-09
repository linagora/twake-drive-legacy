import { config } from 'dotenv';

config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });
export const {
  NODE_ENV,
  SERVER_PORT,
  SERVER_BIND,
  SECRET_KEY,
  CREDENTIALS_ENDPOINT,
  ONLY_OFFICE_SERVER,
  CREDENTIALS_ID,
  CREDENTIALS_SECRET,
  SERVER_PREFIX,
  SERVER_ORIGIN,
  INSTANCE_ID,
  OOCONNECTOR_HEALTH_SECRET,
} = process.env;

const secs = 1000,
  mins = 60 * secs;

export const twakeDriveTokenRefrehPeriodMS = 10 * mins;
export const onlyOfficeForgottenFilesCheckPeriodMS = 10 * mins;
export const onlyOfficeConnectivityCheckPeriodMS = 10 * mins;
export const onlyOfficeCallbackTimeoutMS = 10 * secs;
