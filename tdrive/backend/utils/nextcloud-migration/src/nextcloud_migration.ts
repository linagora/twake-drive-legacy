import { exec } from 'child_process';
// @ts-ignore
import fs from 'fs';
import { LdapUser } from './shell_ldap_user';
import { User } from './ldap_user.js';
import { TwakeDriveClient, TwakeDriveUser } from './twake_client';
import path from 'path';
import { logger } from "./logger"

export type NextcloudMigrationConfiguration = {
  ldap: {
    baseDn: string,
    url: string,
  },
  drive: {
    url: string,
    credentials: {
      appId: string,
      secret: string,
    }
  },
  tmpDir: string,
  nextcloudUrl: string
}

export class NextcloudMigration {

  private config: NextcloudMigrationConfiguration;

  private ldap: LdapUser;

  driveClient: TwakeDriveClient;

  constructor(config: NextcloudMigrationConfiguration) {
    this.config = config;
    this.ldap = new LdapUser(config.ldap);
    this.driveClient = new TwakeDriveClient(this.config.drive);
  }

  async migrate(username: string, password: string) {
    const dir = this.createTmpDir(username);
    try {
      const user = await this.getLDAPUser(username);
      //create user if needed Twake Drive
      const driveUser = await this.driveClient.createUser(user);
      console.log(`Drive user ${driveUser.id} created`);
      //download all files from nextcloud to tmp dir
      await this.download(username, password, dir);
      //upload files to the Twake Drive
      await this.upload(driveUser, dir);
    } catch (e) {
      console.error('Error downloading files from next cloud', e);
      throw e;
    } finally {
      this.deleteDir(dir);
    }
  }

  async download(username: string, password: string, dir: string) {
    return new Promise((resolve, reject) => {
      let cmd = `nextcloudcmd -s --non-interactive -u '${username}' -p '${password}' ${dir} ${this.config.nextcloudUrl}`;
      console.log('Start downloading data from Nextcloud');
      exec(cmd, (error, stdout, stderr) => {
        if (stderr) {
          console.log('ERROR: ' + stderr);
        }
        if (stdout) {
          console.log('OUT: ' + stdout);
        }
        if (error) {
          console.log(`ERROR running sync for the user: ${error.message}`);
          reject(error.message);
        } else {
          console.log('Download finished');
          resolve('');
        }
      });
    });
  }

  async getLDAPUser(username: string): Promise<User> {
    const user = await this.ldap.find(username);
    if (!user.email) {
      throw new Error(`User ${username} not found`);
    }
    return user;
  }

  createTmpDir(username: string) {
    console.log('Creating tmp directory for the user data');
    const dir = this.config.tmpDir + '/' + username + '_' + new Date().getTime();
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory ${dir} ...`);
      fs.mkdirSync(dir);
      console.log(`Directory ${dir} created`);
    } else {
      this.deleteDir(dir);
    }
    return dir;
  }

  deleteDir(dir: string) {
    console.log(`Deleting directory ${dir} ...`);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Directory ${dir} deleted`);
  }

  async upload(user: TwakeDriveUser, sourceDirPath: string, parentDirId = "user_" + user.id) {
    const dirsToUpload: Map<string, string> = new Map<string, string>();
    const filesToUpload: string[] = [];

    const parent = await this.driveClient.getDocument(parentDirId);

    const exists = (filename: string) => {
      return parent.children.filter(i => i.name.startsWith(path.parse(filename).name)).length > 0;
    }

    logger.debug(`Reading content of the directory ${sourceDirPath} ...`)
    fs.readdirSync(sourceDirPath).forEach(function (name) {
      const filePath = path.join(sourceDirPath, name);
      const stat = fs.statSync(filePath);
      if (exists(name)) {
        logger.info(`File ${name} already exists`);
      } else {
        if (stat.isFile()) {
          logger.info(`Add file for future upload ${filePath}`);
          filesToUpload.push(filePath)
        } else if (stat.isDirectory()) {
          logger.info(`Add directory for the future upload ${filePath}`);
          dirsToUpload.set(name, filePath);
        }
      }
    });

    //upload all files
    logger.debug(`UPLOAD FILES FOR  ${sourceDirPath}`)
    for (const file of filesToUpload) {
      logger.debug(`Upload file ${file}`)
      await this.driveClient.createFile(file, parentDirId);
    }

    logger.debug(`UPLOAD DIRS FOR  ${sourceDirPath}`)
    for (const [name, path] of dirsToUpload) {
      logger.info(`Create directory ${name}`);
      const dir = await this.driveClient.createDirectory(name, parentDirId)
      await this.upload(user, path, dir.id);
    }
  }

}