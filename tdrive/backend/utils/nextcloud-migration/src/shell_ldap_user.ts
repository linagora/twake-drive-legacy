import { LdapConfiguration, User } from './ldap_user';
import { exec } from 'child_process';
import ldif from 'ldif';

export class LdapUser {

  private config: LdapConfiguration;

  constructor(config: LdapConfiguration) {
    this.config = config;
  }

  async find(username: string): Promise<User> {
    return new Promise((resolve, reject) => {
      let cmd = `ldapsearch -x -H ${this.config.url} -b '${this.config.baseDn}' '(uid=${username})'`;
      console.log("Executing command to get data from LDAP for " + username);
      exec(cmd, (error, stdout, stderr) => {
        if (stderr) {
          console.log("ERROR: " + stderr);
        }
        if (error) {
          console.log(`ERROR running sync for the user: ${error.message}`);
          reject(new Error(error.message));
        } else {
          if (stdout) {
            try {
              if (stdout.lastIndexOf("# search result") > 0) {
                stdout = stdout.substring(0, stdout.lastIndexOf("# search result"))
              }
              let obj =  ldif.parse(stdout).shift().toObject({});
              console.log(obj);
              resolve({
                lastName: obj.attributes.sn,
                firstName: obj.attributes.givenName,
                email: obj.attributes.mail,
                uid: obj.attributes.uid} as User);
            } catch (e) {
              console.error(e)
              resolve({ } as User);
            }
          } else {
            console.log("No user");
            resolve({ } as User);
          }
        }
      });
    });
  }

}