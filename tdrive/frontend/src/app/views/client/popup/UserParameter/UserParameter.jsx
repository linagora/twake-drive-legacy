/* eslint-disable react/prop-types */
/* eslint-disable react/jsx-key */
import { Component } from 'react';
import Collections from '@deprecated/CollectionsV1/Collections/Collections.js';
import popupManager from '@deprecated/popupManager/popupManager.js';
import currentUserService from '@deprecated/user/CurrentUser';
import LoginService from '@features/auth/login-service';
import Languages from '@features/global/services/languages-service';
import userService from '@features/users/services/current-user-service';
import MenuList from 'components/menus/menu-component.jsx';
import Attribute from 'components/parameters/attribute.tsx';
import './UserParameter.scss';

export default class UserParameter extends Component {
  constructor(props) {
    super(props);
    var user = Collections.get('users').find(userService.getCurrentUserId());
    this.state = {
      login: LoginService,
      i18n: Languages,
      users_repository: Collections.get('users'),
      currentUserService: currentUserService,
      page: popupManager.popupStates['user_parameters'] || props.defaultPage || 1,
      attributeOpen: 0,
      subMenuOpened: 0,
      username: user ? user.username : '',
      last_name: user ? user.last_name : '',
      first_name: user ? user.first_name : '',
      thumbnail: false,
    };
    Collections.get('users').addListener(this);
    Collections.get('users').listenOnly(this, [
      Collections.get('users').find(userService.getCurrentUserId()).front_id,
    ]);
    LoginService.addListener(this);
    Languages.addListener(this);
    currentUserService.addListener(this);
  }
  UNSAFE_componentWillMount() {
    this.setState({ thumbnail: false });
  }
  componentWillUnmount() {
    LoginService.removeListener(this);
    Languages.removeListener(this);
    currentUserService.removeListener(this);
    Collections.get('users').removeListener(this);
  }
  open() {
    this.fileinput.click();
  }

  displayScene() {
    if (this.state.page === 1) {
      return (
        <form className="" autoComplete="off">
          <div className="title">{this.state.i18n.t('scenes.apps.account.title')}</div>
          <div className="group_section">
            <Attribute
              label={`${this.state.first_name} ${this.state.last_name}`}
              description={`${this.state.username}`}
            />
          </div>
          <div className="group_section">
            <Attribute
              label={this.state.i18n.t('scenes.apps.account.languages.menu_title')}
              description={this.state.i18n.t('scenes.apps.account.languages.text')}
            >
              <div className="parameters_form">
                <select
                  value={this.state.i18n.language}
                  onChange={ev => currentUserService.updateLanguage(ev.target.value)}
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="ru">Русский</option>
                </select>
              </div>
            </Attribute>
          </div>
        </form>
      );
    }
  }

  setPage(page) {
    popupManager.popupStates['user_parameters'] = page;
    this.setState({ page: page });
  }
  render() {
    return (
      <div className="userParameter fade_in">
        <div className="main">
          <div className="sideBar">
            <MenuList
              menu={[
                {
                  type: 'menu',
                  text: this.state.i18n.t('scenes.apps.account.title'),
                  selected: this.state.page === 1 ? 'selected' : '',
                  onClick: () => {
                    this.setPage(1);
                  },
                },
              ]}
            />
          </div>
          <div className="content">{this.displayScene()}</div>
        </div>
      </div>
    );
  }
}
