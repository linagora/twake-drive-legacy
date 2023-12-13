import express, { Express, Request, Response } from "express";
import { NextcloudMigration, NextcloudMigrationConfiguration } from './nextcloud_migration.js';

const app: Express = express();
const port = process.env.SERVER_PORT || 3000;

app.use(express.json());
app.use(express.urlencoded());

const config: NextcloudMigrationConfiguration = {
  ldapHost: process.env.LDAP_HOST!,
  ldapPort: process.env.LDAP_PORT!,
  ldapBase: process.env.LDAP_BASE!,
  tmpDir: process.env.TMP_DIR || '/tmp',
  nextcloudUrl: process.env.NEXTCLOUD_URL!
}

if (!config.ldapBase) {
  throw new Error("LDAP base has to be set")
}
if (!config.ldapPort) {
  throw new Error("LDAP port has to be set")
}
if (!config.ldapHost) {
  throw new Error("LDAP host has to be set")
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
  console.log(`Got request for data synchronization with params: ${params}`)
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
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
