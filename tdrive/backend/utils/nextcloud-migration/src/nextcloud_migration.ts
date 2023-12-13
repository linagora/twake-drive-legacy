import { exec } from 'child_process';
import fs from 'fs';

export type NextcloudMigrationConfiguration = {
    ldapHost: string,
    ldapPort: string,
    ldapBase: string,
    tmpDir: string,
    nextcloudUrl: string
}

export class NextcloudMigration {

  private config: NextcloudMigrationConfiguration

  constructor(config: NextcloudMigrationConfiguration) {
    this.config = config;
  }

  async migrate(username: string, password: string) {
    const dir = this.createTmpDir(username);
    try {
      await this.download(username, password, dir);
    } catch (e) {
      console.error("Error downloading files from next cloud", e);
      throw e;
    }finally {
      this.deleteDir(dir)
    }
  }

  async download(username: string, password: string, dir: string) {
    return new Promise((resolve, reject) => {
      let cmd = `nextcloudcmd -s --non-interactive -u '${username}' -p '${password}' ${dir} ${this.config.nextcloudUrl}`;
      console.log("Start downloading data from Nextcloud")
      exec(cmd, (error, stdout, stderr) => {
        if (stderr) {
          console.log("ERROR: " + stderr);
        }
        if (stdout) {
          console.log("OUT: " + stdout);
        }
        if (error) {
          console.log(`ERROR running sync for the user: ${error.message}`);
          reject(error.message)
        } else {
          console.log("Download finished")
          resolve("");
        }
      });
    });
  }

  getLDAPUser(username: string) {

  }

  createTmpDir(username: string) {
    console.log("Creating tmp directory for the user data")
    const dir = this.config.tmpDir + "/" + username + "_" + new Date().getTime();
    if (!fs.existsSync(dir)){
      console.log(`Creating directory ${dir} ...`)
      fs.mkdirSync(dir);
      console.log(`Directory ${dir} created`)
    } else {
      this.deleteDir(dir);
    }
    return dir;
  }

  deleteDir(dir: string) {
    console.log(`Deleting directory ${dir} ...`)
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Directory ${dir} deleted`)
  }

}