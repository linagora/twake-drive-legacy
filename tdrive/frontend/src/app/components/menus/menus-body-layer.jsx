import React from 'react';
import ReactDOM from 'react-dom';

import MenusManager from '@components/menus/menus-manager.jsx';
import MenuComponent from './menu-component.jsx';
import OutsideClickHandler from 'react-outside-click-handler';

/*
  Where the menu will be displayed, this component should be in app.js (menus should be over all elements of the page)
*/
export default class MenusBodyLayer extends React.Component {
  constructor(props) {
    super();
    this.state = {
      menus_manager: MenusManager,
    };
    this.menus_dom = null;
    this.menu_observer = {};
    MenusManager.addListener(this);
    this.outsideMenuListener = this.outsideMenuListener.bind(this);
    this.outsideMenuListenerUp = this.outsideMenuListenerUp.bind(this);

    this.lastUpdatePosition = {};
    this.indexUpdatePosition = {};
  }
  outsideMenuListener() {
    //NOT WORKING
    if (
      MenusManager.menus.length > 0 &&
      MenusManager.menus[MenusManager.menus.length - 1].allowClickOut
    ) {
      this.will_close_on_up = true;
    } else {
      this.will_close_on_up = false;
    }
  }
  outsideMenuListenerUp() {
    //NOT WORKING
    if (
      MenusManager.menus.length > 0 &&
      MenusManager.menus[MenusManager.menus.length - 1].allowClickOut
    ) {
      if (this.will_close_on_up) {
        MenusManager.closeMenu();
      }
    } else {
      this.will_close_on_up = false;
    }
  }
  UNSAFE_componentWillMount() {
    if (!document.getElementById('context-menu-layer')) {
      const div = document.createElement('div');
      div.setAttribute('id', 'context-menu-layer');
      document.body.appendChild(div);
    }
  }
  componentWillUnmount() {
    MenusManager.removeListener(this);
    document.removeEventListener('mousedown', this.outsideClickListener);
    document.removeEventListener('mouseup', this.outsideClickListenerUp);

    Object.keys(this.menu_observer).forEach(index => {
      this.menu_observer[index].disconnect();
    });
  }
  componentDidMount() {
    var element = this.menus_dom;
    this.outsideClickListener = event => {
      if (!element.contains(event.target) && document.contains(event.target)) {
        this.outsideMenuListener();
      }
    };
    this.outsideClickListenerUp = event => {
      if (!element.contains(event.target) && document.contains(event.target)) {
        this.outsideMenuListenerUp();
      }
    };
    document.addEventListener('mousedown', this.outsideClickListener);
    document.addEventListener('mouseup', this.outsideClickListenerUp);
  }
  fixMenuPosition(node, item, index) {
    if (!node) {
      return;
    }

    if (this.lastUpdatePosition[item.id] !== parseInt(new Date().getTime() / 1000)) {
      this.lastUpdatePosition[item.id] = parseInt(new Date().getTime() / 1000);
      this.indexUpdatePosition[item.id] = 0;
    } else if (this.indexUpdatePosition[item.id] > 2) {
      return;
    }
    this.indexUpdatePosition[item.id]++;

    if (this.menu_observer[index]) {
      this.menu_observer[index].disconnect();
    }

    var config = { childList: true, subtree: true };
    this.menu_observer[index] = new MutationObserver(() => {
      this.fixMenuPosition(node, item);
    });
    this.menu_observer[index].observe(node, config);

    var nr = window.getBoundingClientRect(node);
    nr.x = nr.x || nr.left;
    nr.y = nr.y || nr.top;
    var rect = JSON.parse(JSON.stringify(nr || {}));
    rect.height = Math.max(node.offsetHeight, rect.height);
    rect.bottom = rect.height + rect.y;

    var max_bottom = document.documentElement.clientHeight;
    if (item.positionType === 'top') {
      max_bottom = item.position.y;
    }

    //Top
    if (rect.top < 5 || (rect.top > 10 && item.position.marginTop > 0)) {
      item.position.marginTop = Math.max(0, (item.position.marginTop || 0) - rect.top + 5);
      MenusManager.notify();
    }

    //Bottom
    if (item.position.marginTop === undefined || item.position.marginTop < 0) {
      //Else we are on the top top
      if (
        rect.bottom > Math.min(document.documentElement.clientHeight, max_bottom) - 5 ||
        (rect.bottom < Math.min(document.documentElement.clientHeight, max_bottom) - 10 &&
          item.position.marginTop < 0)
      ) {
        item.position.marginTop = Math.min(
          0,
          (item.position.marginTop || 0) -
            (rect.bottom - Math.min(document.documentElement.clientHeight, max_bottom) + 5),
        );
        MenusManager.notify();
      }
    }

    //Left
    if (rect.left < 5 || (rect.left > 10 && item.position.marginLeft > 0)) {
      item.position.marginLeft = Math.max(0, (item.position.marginLeft || 0) - rect.left + 5);
      MenusManager.notify();
    }
    //Right
    else if (
      rect.right > document.documentElement.clientWidth - 5 ||
      (rect.right < document.documentElement.clientWidth - 10 && item.position.marginLeft < 0)
    ) {
      item.position.marginLeft = Math.min(
        0,
        (item.position.marginLeft || 0) - (rect.right - document.documentElement.clientWidth + 5),
      );
      MenusManager.notify();
    }
  }
  shouldComponentUpdate(nextProps, nextState) {
    if (nextState.menus_manager.willClose !== this.willClose) {
      this.willClose = nextState.menus_manager.willClose;
      return true;
    }
    if (this.state.menus_manager.menus.length > 0 || this.last_menu_length > 0) {
      this.last_menu_length = this.state.menus_manager.menus.length;
      return true;
    }
    return false;
  }
  render() {
    return ReactDOM.createPortal(
      <OutsideClickHandler
        onOutsideClick={() => {
          MenusManager.closeMenu();
        }}
      >
        <div ref={node => (this.menus_dom = node)}>
          {this.state.menus_manager.menus.map((item, i) => {
            var menu = (
              <OutsideClickHandler
                key={item.id}
                onOutsideClick={() => {
                  if (i === this.state.menus_manager.menus.length - 1) {
                    MenusManager.closeSubMenu(item.level - 1);
                  }
                }}
              >
                <div
                  ref={node => this.fixMenuPosition(node, item, i)}
                  style={{
                    zIndex: 1050,
                    position: 'absolute',
                    transform: item.positionType === 'bottom' ? '' : 'translateY(-50%)',
                    left: item.position.x - 140,
                    top: item.position.y + 2,
                    marginTop: item.position.marginTop,
                    marginLeft: item.position.marginLeft,
                  }}
                >
                  <MenuComponent
                    withFrame
                    menu={item.menu}
                    openAt={item.openAt}
                    level={item.level}
                    animationClass={
                      this.state.menus_manager.willClose || item.willClose
                        ? 'fade_out'
                        : item.level === 0 || item.positionType
                        ? item.positionType === 'bottom'
                          ? 'skew_in_bottom_nobounce'
                          : item.left
                          ? 'skew_in_left_nobounce'
                          : 'skew_in_right_nobounce'
                        : 'fade_in'
                    }
                  />
                </div>
              </OutsideClickHandler>
            );

            return menu;
          })}
        </div>
      </OutsideClickHandler>,
      document.getElementById('context-menu-layer'),
    );
  }
}
