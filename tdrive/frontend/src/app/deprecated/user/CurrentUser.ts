/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-explicit-any */
import $ from 'jquery';
import Login from '@features/auth/login-service';
import Collections from '@deprecated/CollectionsV1/Collections/Collections';
import Api from '@features/global/framework/api-service';
import Observable from '@deprecated/CollectionsV1/observable';
import Number from '@features/global/utils/Numbers';
import AlertManager from '@features/global/services/alert-manager-service';
import Languages from '@features/global/services/languages-service';
import JWTStorage from '@features/auth/jwt-storage-service';
import Globals from '@features/global/services/globals-tdrive-app-service';
import UserAPIClient from '../../features/users/api/user-api-client';
import { getUser } from '@features/users/hooks/use-user-list';

class CurrentUser extends Observable {
  loading: boolean;
  errorUsernameExist: boolean;
  errorUnkown: boolean;
  errorBadImage: boolean;
  unique_connection_id: string;
  badNewPassword: boolean;
  error_identity_badimage: boolean;
  badOldPassword: boolean;
  error_secondary_mail_already: boolean;
  error_code: boolean;
  addmail_token: string;

  constructor() {
    super();
    this.setObservableName('currentUserService');
    this.loading = false;
    this.errorUsernameExist = false;
    this.errorUnkown = false;
    this.errorBadImage = false;
    this.badNewPassword = false;
    this.unique_connection_id = Number.unid();
    this.error_identity_badimage = false;
    this.badOldPassword = false;
    this.error_secondary_mail_already = false;
    this.error_code = false;
    this.addmail_token = '';

    (Globals.window as any).currentUser = this;
  }

  start = () => undefined;

  get() {
    return getUser(Login.currentUserId);
  }

  updateTutorialStatus(key: string, set_false?: unknown) {
    const user = this.get();
    if (!user) {
      return;
    }
    if (!user.tutorial_status || user.tutorial_status.length === 0) {
      user.tutorial_status = {};
    }
    if (user.tutorial_status[key] === (set_false ? false : true)) {
      return;
    }
    user.tutorial_status[key] = set_false ? false : true;
    Collections.get('users').updateObject(this.get());

    const data = {
      status: user.tutorial_status,
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    Api.post('/ajax/users/account/set_tutorial_status', data, () => {});
  }

  async updateLanguage(lng: string) {
    await Languages.setLanguage(lng)
      .then(() => console.log("Language set to " + lng));

    const preferences = {
      ... this.get().preferences,
      language: lng,
      locale: lng,
    }
    await UserAPIClient
      .setUserPreferences(preferences)
      .then(() => console.log("User preferences set to:  " + preferences))
      .then(() => console.log(preferences))
      .then(() => window.location.reload())
      .catch(e => "Error setting user preferences " + e);
  }

  updateUserName(username: string) {
    const that = this;
    const update = {
      id: Login.currentUserId,
      username: username,
    };
    Collections.get('users').updateObject(update);
    that.loading = true;
    that.notify();
    Api.post('/ajax/users/account/username', { username }, (res: any) => {
      that.loading = false;
      if (res.errors.length === 0) {
        that.errorUsernameExist = false;
      } else {
        that.errorUsernameExist = true;
      }
      that.notify();
    });
  }

  updateidentity(last_name: string, first_name: string, thumbnail: string) {
    this.loading = true;
    this.notify();

    const route = Globals.api_root_url + '/ajax/users/account/identity';
    const data = new FormData();

    if (thumbnail) {
      data.append('thumbnail', thumbnail);
    }

    data.append('first_name', first_name || '');
    data.append('last_name', last_name || '');

    this.updateTutorialStatus('has_identity');

    const that = this;

    $.ajax({
      url: route,
      type: 'POST',
      data: data,
      cache: false,
      contentType: false,
      processData: false,
      xhrFields: {
        withCredentials: true,
      },
      headers: {
        Authorization: JWTStorage.getAutorizationHeader(),
      },
      xhr: function () {
        const myXhr = $.ajaxSettings.xhr();
        myXhr.onreadystatechange = function () {
          if (myXhr.readyState === XMLHttpRequest.DONE) {
            that.loading = false;
            const resp = JSON.parse(myXhr.responseText);
            if (resp.errors.indexOf('badimage') > -1) {
              that.error_identity_badimage = true;
              that.notify();
            } else {
              const update = {
                id: Login.currentUserId,
                first_name,
                last_name,
                thumbnail: '',
              };
              if (!thumbnail) {
                update.thumbnail = resp.data.thumbnail || '';
              }
              Collections.get('users').updateObject(update);
              that.notify();
            }
          }
        };
        return myXhr;
      },
    });
  }

  updatePassword(oldPassword: string, password: string, password1: string) {
    oldPassword = oldPassword || '';
    password = password || '';
    password1 = password1 || '';
    if (password !== password1 || password.length < 8) {
      this.badNewPassword = true;
      this.notify();
      return;
    }
    const that = this;
    that.loading = true;
    that.notify();
    Api.post(
      '/ajax/users/account/password',
      { old_password: oldPassword, password: password },
      (res: any) => {
        that.loading = false;
        if (res.errors.length === 0) {
          that.badNewPassword = false;
          that.badOldPassword = false;

          AlertManager.alert(() => undefined, {
            text: Languages.t(
              'services.user.update_password_alert',
              [],
              'Votre mot de passe a été mis à jour.',
            ),
          });
        } else {
          that.badNewPassword = false;
          that.badOldPassword = true;
        }
        that.notify();
      },
    );
  }

  addNewMail(mail: string, cb: (arg: any) => any, thot: any) {
    const that = this;
    that.loading = true;
    that.error_secondary_mail_already = false;
    that.error_code = false;
    that.notify();
    Api.post('/ajax/users/account/addmail', { mail: mail }, (res: any) => {
      that.loading = false;

      if (res.errors.indexOf('badmail') > -1) {
        that.error_secondary_mail_already = true;
        that.notify();
      } else {
        that.addmail_token = res.data.token;
        that.notify();
        cb(thot);
      }
    });
  }

  makeMainMail(mailId: string) {
    const that = this;
    that.loading = true;
    that.notify();
    Api.post('/ajax/users/account/mainmail', { mail: mailId }, (res: any) => {
      if (res.errors.length === 0) {
        const mails = Collections.get('users').find(Login.currentUserId).mails;
        for (let i = 0; i < mails.length; i++) {
          mails[i].main = false;
          if (mails[i].id === mailId) {
            mails[i].main = true;
          }
        }
        const update = {
          id: Login.currentUserId,
          mails: mails,
        };
        Collections.get('users').updateObject(update);
      }
      that.loading = false;
      that.notify();
    });
  }

  removeMail(mailId: string) {
    const that = this;
    that.loading = true;
    that.notify();
    Api.post('/ajax/users/account/removemail', { mail: mailId }, (res: any) => {
      if (res.errors.length === 0) {
        const mails = Collections.get('users').find(Login.currentUserId).mails;
        const newMails = [];
        for (let i = 0; i < mails.length; i++) {
          if (mails[i].id !== mailId) {
            newMails.push(mails[i]);
          }
        }
        const update = {
          id: Login.currentUserId,
          mails: newMails,
        };
        Collections.get('users').updateObject(update);
      }
      that.loading = false;
      that.notify();
    });
  }
}

export default new CurrentUser();
