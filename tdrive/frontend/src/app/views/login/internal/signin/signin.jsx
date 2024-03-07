import React, { Component } from 'react';

import Languages from '@features/global/services/languages-service';
import LoginService from '@features/auth/login-service';
import Emojione from 'components/emojione/emojione';
import StepCounter from 'components/step-counter/step-counter.jsx';
import ButtonWithTimeout from 'components/buttons/button-with-timeout.jsx';
import Input from 'components/inputs/input.jsx';
export default class Signin extends Component {
  constructor() {
    super();

    this.disableEmailVerification = true; //Not impoelemnted: InitService.server_infos?.configuration?.accounts?.type?.internal?.disable_email_verification;

    this.state = {
      login: LoginService,
      i18n: Languages,
      username: '',
      email: LoginService.emailInit,
      password: '',
      lastName: '',
      firstName: '',
      phone: '',
      code: '',
      newsletter: true,
      page: 1,
      invalidForm: false,
      patternRegMail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      mailAvailable: true,
      usernameAvailable: true,
      errorMail: false,
      errorUsername: false,
      errorPassword: false,
      errorCode: false,
    };
    LoginService.addListener(this);
    Languages.addListener(this);
  }
  componentDidMount() {
    if (this.input) {
      this.input.focus();
    }
  }
  componentWillUnmount() {
    LoginService.removeListener(this);
    Languages.removeListener(this);
  }
  componentDidUpdate(_prevProps, prevState) {
    if (
      (prevState.page === 1 && this.state.page === 2) ||
      (prevState.page === 2 && this.state.page === 3 && this.input)
    ) {
      if (this.input) this.input.focus();
    }
  }
  displayStep() {
    if (this.state.page === 1) {
      return (
        <div className="">
          <div className="subtitle">
            {this.state.i18n.t('scenes.login.create_account.step_1_subtitle')}{' '}
            <Emojione type=":smile:" />
          </div>

          {this.state.login.error_subscribe_username && this.state.username && (
            <div className={'error text bottom-margin'}>
              {this.state.i18n.t('scenes.login.create_account.username_already_exist')}
            </div>
          )}
          {this.state.username && this.state.errorUsername && (
            <div className={'text error bottom-margin'}>
              {this.state.i18n.t('scenes.login.create_account.fill_in_username', [])}
            </div>
          )}

          <Input
            id="first_name_create"
            className="bottom-margin medium full_width"
            onKeyDown={e => {
              if (e.keyCode === 13) {
                this.next();
              }
            }}
            placeholder={this.state.i18n.t(
              'scenes.login.create_account.first_name',
              [],
              'First name',
            )}
            value={this.state.firstName}
            onChange={evt => this.setState({ firstName: evt.target.value })}
          />
          <Input
            id="last_name_create"
            refInput={ref => {
              this.input = ref;
            }}
            className="bottom-margin medium full_width"
            onKeyDown={e => {
              if (e.keyCode === 13) {
                this.next();
              }
            }}
            placeholder={this.state.i18n.t(
              'scenes.login.create_account.last_name',
              [],
              'Last name',
            )}
            value={this.state.lastName}
            onChange={evt => this.setState({ lastName: evt.target.value })}
          />

          <br />
          <br />

          {this.state.login.error_subscribe_mailalreadyused && this.state.email && (
            <div className="text error bottom-margin">
              {this.state.i18n.t('scenes.login.create_account.email_used')}
            </div>
          )}
          {this.state.errorMail && (
            <div className={'text error bottom-margin'}>
              {this.state.i18n.t('scenes.login.create_account.fill_in_email')}
            </div>
          )}
          <Input
            onBlur={() => this.updateFieldError('errorMail', () => this.checkMail())}
            id="email_create"
            className={
              'bottom-margin medium full_width ' +
              (this.state.login.error_subscribe_mailalreadyused ? 'error' : '')
            }
            onKeyDown={e => {
              if (e.keyCode === 13) {
                this.next();
              }
            }}
            placeholder={this.state.i18n.t('scenes.login.create_account.email')}
            value={this.state.email}
            onChange={evt => this.setState({ email: evt.target.value })}
          />

          {this.state.errorPassword && (
            <div className={'text error bottom-margin'}>
              {this.state.i18n.t('scenes.login.create_account.too_short_password')}
            </div>
          )}
          <Input
            onBlur={() => this.updateFieldError('errorPassword', () => this.checkPassword())}
            id="password_create"
            type="password"
            className={
              'bottom-margin medium full_width ' + (this.state.errorPassword ? 'error' : '')
            }
            onKeyDown={e => {
              if (e.keyCode === 13) {
                this.next();
              }
            }}
            placeholder={this.state.i18n.t('scenes.login.create_account.password')}
            value={this.state.password}
            onChange={evt => this.setState({ password: evt.target.value })}
          />
          <div className="bottom">
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a href="#" className="returnBtn blue_link" onClick={() => this.previous()}>
              {this.state.i18n.t('general.back')}
            </a>
            <ButtonWithTimeout
              id="continue_btn"
              medium
              disabled={!this.checkForm() || this.state.login.login_loading}
              onClick={() => this.next()}
              value={this.state.i18n.t('general.continue')}
              loading={this.state.login.login_loading}
              loadingTimeout={2000}
            />
          </div>
        </div>
      );
    }
    if (this.state.page == 2 && !this.disableEmailVerification) {
      return (
        <div>
          <div className="subtitle">
            {this.state.i18n.t('scenes.login.create_account.step_3_subtitle')}{' '}
            <Emojione type=":robot:" />
          </div>

          <div className="big_emoji">
            <Emojione type=":love_letter:" s64 />
          </div>
          <br />
          <br />

          <div className="subtitle" style={{ marginBottom: 0 }}>
            {this.state.i18n.t('scenes.login.create_account.step_3_mail_sent')}
          </div>

          <br />

          <ButtonWithTimeout
            medium
            style={{ width: 'auto' }}
            onClick={() => {
              this.subscribeMail();
            }}
            value={'Send again'}
            loading={this.state.login.login_loading}
            loadingTimeout={2000}
          />
        </div>
      );
    }
    if (this.state.page == 2 && this.disableEmailVerification) {
      setTimeout(() => {
        window.document.location.reload();
      }, 2000);

      return (
        <div className="">
          <div className="subtitle">
            <Emojione type=":hourglass:" />{' '}
          </div>
        </div>
      );
    }
  }

  updateFieldError(stateName, test) {
    this.setState({ [stateName]: !test() });
  }

  checkUsername = () => {
    return !(this.state.username.length <= 1);
  };

  checkMail = () => {
    return !!this.state.patternRegMail.test(this.state.email.toLocaleLowerCase());
  };

  checkPassword = () => {
    return this.state.password.length >= 8;
  };

  checkForm() {
    return this.checkMail() && this.checkPassword();
  }

  previous() {
    if (this.state.page <= 1) {
      this.state.login.changeState('logged_out');
    } else {
      this.setState({ page: this.state.page - 1 });
    }
  }
  async next() {
    if (this.state.page === 1) {
      if (this.checkForm()) {
        try {
          await LoginService.signup({
            username: this.state.email,
            email: this.state.email,
            firstName: this.state.firstName,
            lastName: this.state.lastName,
            password: this.state.password,
          });
          this.setState({ page: this.state.page + 1 });
        } catch (err) {
          this.setState({ errorMail: true });
        }
      }
    } else {
      this.setState({ page: this.state.page + 1 });
    }
  }
  sub(that, state) {
    // that.login(username, password, 1);
    if (state === 0) {
      that.setState({ page: 3 });
    }
    if (state === 1) {
      that.setState({ page: 1 });
      that.state.errorSub = true;
    }
  }
  checkAvailable(that, numError) {
    switch (numError) {
      case 0:
        that.setState({ page: 2 });
        break;
      case 1:
        that.setState({ invalidForm: true });
        that.setState({ mailAvailable: false });
        break;
      case 2:
        that.setState({ invalidForm: true });
        that.setState({ mailAvailable: false });
        that.setState({ usernameAvailable: false });
        break;
      default:
        break;
    }
  }
  render() {
    return (
      <div className="signin">
        <div className="center_box_container login_view fade_in">
          <div className="center_box white_box_with_shadow" style={{ width: '400px' }}>
            <StepCounter total={2} current={this.state.page} />
            <div className="title">
              {this.state.i18n.t('scenes.login.create_account.title')} {this.state.page}/2
            </div>
            {this.displayStep()}
          </div>
        </div>
      </div>
    );
  }
}
