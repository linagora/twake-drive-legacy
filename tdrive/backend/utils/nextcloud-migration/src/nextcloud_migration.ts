import { exec } from 'child_process';
// @ts-ignore
import fs from 'fs';
import { ShellLdapUserProvider } from './shell_ldap_user';
import { TwakeDriveClient, TwakeDriveUser } from './twake_client';
import path from 'path';
import { logger } from "./logger"
import { User, UserProvider, UserProviderFactory, UserProviderType } from "./user_privider";

export interface NextcloudMigrationConfiguration {
  shell: {
    baseDn: string,
    url: string,
  },
  lemon: {
    url: string,
    auth: string,
  }
  drive: {
    url: string,
    credentials: {
      appId: string,
      secret: string,
    }
  },
  tmpDir: string,
  nextcloudUrl: string
  userProvider: UserProviderType
}

export class NextcloudMigration {

  private config: NextcloudMigrationConfiguration;

  private userProvider: UserProvider;

  driveClient: TwakeDriveClient;

  constructor(config: NextcloudMigrationConfiguration) {
    this.config = config;
    this.userProvider = (new UserProviderFactory()).get(config.userProvider, config[config.userProvider]);
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
    const user = await this.userProvider.find(username);
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
    const existingFiles: string[] = [];

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
        //find document that we need to replace
        existingFiles.push(filePath);
        //skip
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
    //check existing files
    for (const fPath of existingFiles) {
      logger.debug(`Check existing file ${fPath}`)
      let name = path.parse(fPath).name;
      let candidatesWithTheSameName = parent.children.filter(i => i.name.startsWith(name));
      if (candidatesWithTheSameName.length > 1) {
        logger.warn("WE HAVE MORE MORE THAN ONE FILE WITH NAME: " + name);
      } else {
        const doc = candidatesWithTheSameName[0];
        //check that it exists in S3
        if (await this.driveClient.existsInS3(doc.id)) {
          logger.info(`File ${name}, docId = ${doc.id} exists in S3`);
        } else {
          //if it doesn't exists upload just one file
          logger.info(`File ${name}, is missing, uploading files`);
          await this.driveClient.uploadToS3(fPath, doc.id);
        }
      }
    }


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