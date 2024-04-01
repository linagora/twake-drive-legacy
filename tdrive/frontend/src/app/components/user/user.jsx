// eslint-disable-next-line no-use-before-define
import React, { Component } from 'react';

import UserService from '@features/users/services/current-user-service';

import './user.scss';

export default class User extends Component {
  constructor(props) {
    super();
  }
  render() {
    var user = this.props.user;
    var notifications_disabled = false;
    return (
      <div
        className={
          'user_head ' +
          (this.props.small ? 'small ' : '') +
          (this.props.withBorder === undefined || this.props.withBorder ? 'border ' : '') +
          (this.props.medium ? 'medium ' : '') +
          (this.props.big ? 'big ' : '')
        }
        style={{
          backgroundImage: `url(${UserService.getThumbnail(user)}`,
          width: this.props.size,
          height: this.props.size,
        }}
      >
      </div>
    );
  }
}
