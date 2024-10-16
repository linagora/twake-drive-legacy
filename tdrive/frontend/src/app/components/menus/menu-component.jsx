import React, { Component } from 'react';

import Icon from '@components/icon/icon.jsx';
import Emojione from 'components/emojione/emojione';
import MenusManager from '@components/menus/menus-manager.jsx';
import './menu.scss';

/*
  One menu
*/
export default class MenuComponent extends React.Component {
  constructor(props) {
    super();
    this.state = {
      menus_manager: MenusManager,
    };
    MenusManager.addListener(this);
  }
  componentWillUnmount() {
    MenusManager.removeListener(this);
  }
  openSubMenu(dom_element, menu, level) {
    var elementRect = window.getBoundingClientRect(dom_element);
    elementRect.x = elementRect.x || elementRect.left;
    elementRect.y = elementRect.y || elementRect.top;
    MenusManager.openSubMenu(menu, elementRect, level);
  }
  closeSubMenu(level) {
    MenusManager.closeSubMenu(level);
  }
  hoverMenu(dom_element, item) {
    if (item.submenu && !item.submenu_replace) {
      this.last_hovered = item;
      this.openSubMenu(dom_element, item.submenu, this.props.level || 0);
    } else {
      this.closeSubMenu(this.props.level || 0);
    }
  }
  clickMenu(dom_element, item, evt) {
    if(Date.now() - this.props.openAt < 200 ){
      // When a menu is open and another one opens above it, you have to block the buttons for a while. Otherwise, the hovered option of the new menu will be clicked
      return;
    }
    if (item.submenu_replace) {
      MenusManager.openMenu(item.submenu, { x: evt.clientX, y: evt.clientY }, 'center');
      return;
    }
    if (item.onClick) {
      var res = item.onClick(evt);
      if (res !== false) {
        MenusManager.closeMenu();
      }
    }
  }
  render() {
    return (
      <div
        ref={node => (this.original_menu = node)}
        className={
          'menu-list ' + (this.props.withFrame ? 'as_frame text-black bg-white dark:bg-zinc-900 dark:text-white rounded-lg ' : '') + this.props.animationClass
        }
      >
        {(this.props.menu || [])
          .filter(item => item && !item.hide)
          .map((item, index) => {
            if (item.type == 'separator') {
              return <div key={'menu_' + index} className="menu-separator" />;
            } else if (item.type == 'title') {
              return (
                <div key={'menu_' + index} className={'menu-title ' + item.className}>
                  {item.text}
                </div>
              );
            } else if (item.type == 'text') {
              return (
                <div
                  key={'menu_' + index}
                  ref={node => (item.ref = node)}
                  className={'menu-text ' + item.className}
                  onMouseEnter={evt => {
                    this.hoverMenu(item.ref, item);
                  }}
                >
                  {item.icon && (
                    <div className="icon">
                      {typeof item.icon === 'string' ? <Icon type={item.icon} /> : item.icon}
                    </div>
                  )}
                  <div className="text">{item.text}</div>
                </div>
              );
            } else if (item.type == 'react-element') {
              return (
                <div
                  key={'menu_' + index}
                  className={'menu-custom ' + item.className}
                  onClick={item.onClick}
                >
                  {typeof item.reactElement == 'function'
                    ? item.reactElement(this.props.level)
                    : item.reactElement}
                </div>
              );
            } else {
              return (
                <div
                  key={'menu_' + index}
                  ref={node => (item.ref = node)}
                  className={
                    'menu ' +
                    item.className +
                    ' ' +
                    (this.state.menus_manager.max_level > this.props.level &&
                    this.last_hovered == item
                      ? 'hovered '
                      : '') +
                    (item.selected ? 'selected ' : '')
                  }
                  onMouseEnter={evt => {
                    this.hoverMenu(item.ref, item);
                  }}
                  onClick={evt => {
                    this.clickMenu(item.ref, item, evt);
                  }}
                >
                  {item.icon && (
                    <div className="icon">
                      {typeof item.icon === 'string' ? <Icon type={item.icon} /> : item.icon}
                    </div>
                  )}
                  {item.emoji && (
                    <div className="icon">
                      <Emojione type={item.emoji} />
                    </div>
                  )}
                  <div className="text">{item.text}</div>
                  <div className="more">
                    {item.rightIcon && <Icon type={item.rightIcon} />}
                    {item.submenu && !item.submenu_replace && <Icon type="angle-right" />}
                  </div>
                </div>
              );
            }
          })}
      </div>
    );
  }
}
