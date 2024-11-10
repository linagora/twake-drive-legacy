import React, { Component } from 'react';
import './popup-component.scss';
import popupManager from '@deprecated/popupManager/popupManager.js';
import CloseIcon from '@material-ui/icons/CloseOutlined';

export default class PopupComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      popupManager: popupManager,
    };
    popupManager.addListener(this);
  }
  componentWillUnmount() {
    popupManager.removeListener(this);
    document.removeEventListener('keydown', this.eventClose);
  }
  componentDidMount() {
    document.addEventListener('keydown', this.eventClose);
  }
  eventClose(evt) {
    if (evt.keyCode == 27 && popupManager.canClose()) {
      popupManager.close();
    }
  }
  render() {
    return (
      <div className="popupComponent">
        {this.state.popupManager.canClose() && (
          <div className="header">
            <div className="close" onClick={() => this.state.popupManager.close()}>
              <CloseIcon className="m-icon" />
            </div>
          </div>
        )}
        <div className="componentContainer">
          <div className="component">{this.state.popupManager.getComponent()}</div>
        </div>
      </div>
    );
  }
}
