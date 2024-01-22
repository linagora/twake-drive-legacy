import express, { Express, Request, Response } from "express";
import { NextcloudMigration, NextcloudMigrationConfiguration } from './nextcloud_migration';
import { logger } from "./logger"
import { UserProviderType } from "./user_privider";

const app: Express = express();
const port = process.env.SERVER_PORT || 3000;

app.use(express.json());
app.use(express.urlencoded());

const config: NextcloudMigrationConfiguration = {
  shell: {
    baseDn: process.env.LDAP_BASE!,
    url: process.env.LDAP_URL!,
  },
  lemon: {
    url: process.env.LEMON_USERS_URL!,
    auth: process.env.LEMON_USERS_AUTH!,
  },
  tmpDir: process.env.TMP_DIR || '/tmp',
  nextcloudUrl: process.env.NEXTCLOUD_URL!,
  drive: {
    url: process.env.TWAKE_DRIVE_URL!,
    credentials: {
      appId: process.env.TWAKE_DRIVE_APP_ID!,
      secret: process.env.TWAKE_DRIVE_SECRET!,
    }
  },
  userProvider: process.env.USER_PROVIDER! as UserProviderType
}

// if (!config.shell.baseDn) {
//   throw new Error("LDAP base has to be set")
// }
// if (!config.shell.url) {
//   throw new Error("LDAP url has to be set")
// }

if (!config.drive.url) {
  throw new Error("Twake Drive url  host has to be set")
}
if (!config.drive.credentials.appId) {
  throw new Error("Twake Drive application identifier host has to be set")
}
if (!config.nextcloudUrl) {
  throw new Error("Nextcloud url has to be set")
}

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, to run the the migration process you should send post request.");
});

const nextcloud = new NextcloudMigration(config);

app.post("/", async (req: Request, res: Response) => {
  const params = req.body;
  logger.info(`Got request for data synchronization with params: ${params}`)
  if (!params || !params["username"] || !params.password) {
    res.status(400).send("Username and password for nextcloud are required");
  }
  try {
    await nextcloud.migrate(params.username, params.password);
    res.status(200).send("Sync DONE ✅");
  } catch (e) {
    console.error(e)
    res.status(500).send("Error during synchronization:: " + e.message)
  }

});

app.listen(port, () => {
  logger.info(`[server]: Server is running at http://localhost:${port}`);
});
