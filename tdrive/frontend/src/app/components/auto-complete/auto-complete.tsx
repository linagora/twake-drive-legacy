/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Component } from 'react';
import AutoHeight from '../auto-height/auto-height';
import Input from '../inputs/input';
import './auto-complete.scss';

type State = {
  currentList: any[];
  selected: number;
  resultPosition: string;
  selectedUser: object;
  focused: any;
};

type Props = {
  onResize?: any;
  autoHeight?: any;
  className?: string;
  placeholder?: string;
  search: ((text: string, cb: (arr: any) => any) => void)[];
  max: number[];
  onSelect?: (obj: object, other: any) => void;
  renderItem: ((obj: object) => any)[];
  renderItemChoosen: ((el: any) => any)[];
  regexHooked: any;
  onChange?: any;
  value?: any;
  onChangeCurrentList?: any;
  hideResult?: any;
  onBackspace?: any;
  disableNavigationKey?: any;
  showResultsOnInit?: any;
  position?: any;
  onHide?: any;
  onEscape?: any;
  keyUp?: any;
  onKeyUp?: any;
  onKeyDown?: any;
  onKeyPress?: any;
  onPaste?: any;
  onFocusChange?: any;
  big?: boolean;
  small?: boolean;
  autoFocus?: any;
};

export default class AutoComplete extends Component<Props, State> {
  currentIdFromList = '';
  is_open = false;
  input: any;
  container: any;
  outsideClickListener: any;
  currentRegexUsed: any = -1;

  constructor(props: any) {
    super(props);

    this.state = {
      currentList: [],
      selected: -1,
      resultPosition: '',
      selectedUser: {},
      focused: '',
    };

    this.keyUp = this.keyUp.bind(this);
    this.keyDown = this.keyDown.bind(this);
  }
  keyDown(ev: any) {
    const key = ev.which || window.event;

    if (
      this.is_open &&
      key &&
      this.currentRegexUsed >= 0 &&
      this.state.currentList.length > 0 &&
      (key === 13 || key === 9 || key === 38 || key === 40)
    ) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    if (key === 27 && !this.is_open && this.props.onEscape) {
      this.props.onEscape();
    }
    if (key === 27 && this.is_open && this.props.onHide) {
      this.is_open = false;
      this.props.onHide();
    }
  }
  keyUp(ev: any) {
    const key = ev.which;
    const allText = this.getValueBeforeCaret();
    if (key === 8 && this.input.value.length === 0 && this.props.onBackspace) {
      this.props.onBackspace();
    }
    for (let i = 0; i < this.props.regexHooked.length; i++) {
      let text = allText.match(this.props.regexHooked[i]);
      if (text && allText) {
        if (this.currentRegexUsed < 0 || this.currentRegexUsed !== i) {
          this.currentRegexUsed = i;
        }
        text = text[1] || '';
        if (
          key &&
          !this.props.disableNavigationKey &&
          (key === 13 || key === 9 || key === 38 || key === 40) &&
          this.state.currentList.length > 0
        ) {
          ev.preventDefault();
          ev.stopPropagation();
          if (key === 13 || key === 9) {
            //Select (enter)
            this.select((this.state.currentList || {})[this.state.selected]);
          } else if (key === 38 || key === 40) {
            //Up // down
            let nextState = 0;
            if (
              (key === 38 && this.state.resultPosition === 'top') ||
              (key === 40 && this.state.resultPosition === 'bottom')
            ) {
              nextState = (this.state.selected + 1) % this.state.currentList.length;
            } else {
              nextState =
                (this.state.selected + this.state.currentList.length - 1) %
                this.state.currentList.length;
            }
            this.setState({
              selected: nextState,
            });
            this.currentIdFromList = this.getCurrentIdFromList(this.state.currentList, nextState);
          }
        } else {
          this.is_open = true;
          this.search(text, i);
        }
        if (this.props.onChangeCurrentList) {
          this.props.onChangeCurrentList(this.state.currentList, this.state.selected);
        }
        return;
      }
    }

    this.currentRegexUsed = -1;
    this.setState({ currentList: [], resultPosition: '' });
    this.props.keyUp && this.props.keyUp(ev);
  }

  getCurrentIdFromList(list: any[], pos: number) {
    if (!list[pos]) {
      return;
    }
    const id = list[pos].id || JSON.stringify(list[pos]);
    return id;
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.outsideClickListener);
    this.input.removeEventListener('keydown', this.keyDown);
    this.input.removeEventListener('keyup', this.keyUp);
  }
  componentDidMount() {
    const element = this.container;
    this.outsideClickListener = (event: any) => {
      if (!element.contains(event.target) && document.contains(event.target)) {
        this.setState({ focused: false });
      }
    };
    this.outsideClickListener = this.outsideClickListener.bind(this);
    document.addEventListener('click', this.outsideClickListener);

    this.input.addEventListener('keydown', this.keyDown);
    this.input.addEventListener('keyup', this.keyUp);

    if (this.props.showResultsOnInit) {
      this.currentRegexUsed = 0;
      this.search('', 0);
      this.props.onChangeCurrentList(this.state.currentList, this.state.selected);
    }
  }
  search(query: any, i: any) {
    this.props.search[this.currentRegexUsed](query, results => {
      if (!this.is_open) {
        return;
      }

      const suggestions: any[] = [];
      for (let j = 0; j < Math.min(this.props.max[this.currentRegexUsed], results.length); j++) {
        results[j].autocomplete_id = j;
        suggestions.push(results[j]);
      }

      let selection = 0;

      const idsFromSuggestedList = suggestions.map(
        (item, index) => (item = this.getCurrentIdFromList(suggestions, index)),
      );

      selection = Math.max(idsFromSuggestedList.indexOf(this.currentIdFromList), 0);

      this.currentRegexUsed = i;
      this.setState({
        selected: selection,
        currentList: suggestions,
      });

      this.currentIdFromList = this.getCurrentIdFromList(suggestions, selection);

      if (this.props.onChangeCurrentList) {
        this.props.onChangeCurrentList(suggestions, this.state.selected);
      }
    });
  }
  getValueBeforeCaret() {
    return this.input.value.substr(0, this.input.selectionStart);
  }
  putTextAtCursor(text: string, alreadyTypedLength: any) {
    alreadyTypedLength = alreadyTypedLength || 0;

    const myValue = text;

    if (this.input.selectionStart || this.input.selectionStart === '0') {
      const startPos = this.input.selectionStart;
      const endPos = this.input.selectionEnd;
      this.input.value =
        this.input.value.substring(0, startPos - alreadyTypedLength) +
        myValue +
        this.input.value.substring(endPos, this.input.value.length);
      this.input.selectionStart = this.input.selectionStart + myValue.length;
      this.input.selectionEnd = this.input.selectionStart + myValue.length;
    } else {
      this.input.value += myValue;
    }

    if (this.props.onChange) this.props.onChange({ target: { value: this.input.value } });

    this.input.focus();
    this.input.dispatchEvent(new Event('input'));

    this.setState({
      selected: -1,
      currentList: [],
    });
  }
  select(item: any) {
    if (!item) {
      return;
    }

    const m = this.getValueBeforeCaret().match(this.props.regexHooked[this.currentRegexUsed]);
    if (m === null) {
      return;
    }
    const alreadyTypedLength = m[0].length;

    this.putTextAtCursor(
      this.props.renderItemChoosen[this.currentRegexUsed](item),
      alreadyTypedLength,
    );

    if (this.props.onSelect) {
      this.props.onSelect(item, this.currentRegexUsed);
    }
    this.is_open = false;
  }
  setPositionResult() {
    if (this.input && this.state.resultPosition === '' && this.state.currentList.length > 0) {
      const size = this.state.currentList.length * 32 + 5;
      if (
        document.documentElement.clientHeight -
          (window as any).getBoundingClientRect(this.input).bottom <
          size ||
        this.props.position === 'top'
      ) {
        this.setState({ resultPosition: 'top' });
      } else {
        this.setState({ resultPosition: 'bottom' });
      }
    }
  }
  focus() {
    if (!this.input) {
      return;
    }
    this.input.focus();
    this.setState({ focused: true });
    this.keyUp({});
  }
  blur() {
    this.input.blur();
    this.setState({ focused: false });
  }
  setContent(content: any) {
    this.input.value = content;
  }
  render() {
    this.setPositionResult();
    return (
      <div
        className={
          'autocomplete ' +
          (this.props.className || '') +
          ' ' +
          (this.state.focused && this.state.currentList.length ? 'focused ' : '')
        }
        onClick={() => {
          this.focus();
          this.setState({ focused: true });
        }}
        ref={node => (this.container = node)}
      >
        <div className={this.state.resultPosition}>
          {this.props.autoHeight && (
            <AutoHeight
              className={'' + (this.props.big ? ' big' : this.props.small ? ' small' : ' medium')}
              refInput={(ref: any) => {
                this.input = ref;
              }}
              onResize={this.props.onResize}
              placeholder={this.props.placeholder}
              value={this.props.value}
              onChange={this.props.onChange}
              onKeyUp={this.props.onKeyUp}
              onKeyDown={this.props.onKeyDown}
              onKeyPress={this.props.onKeyPress}
              onPaste={this.props.onPaste}
              onFocus={() => {
                if (this.props.onFocusChange) {
                  this.props.onFocusChange(true);
                }
              }}
              onBlur={() => {
                if (this.props.onFocusChange) {
                  this.props.onFocusChange(false);
                }
              }}
              autoFocus={this.props.autoFocus}
            />
          )}
          {!this.props.autoHeight && (
            <Input
              className={
                'full_width ' + (this.props.big ? ' big' : this.props.small ? ' small' : ' medium')
              }
              refInput={(ref: any) => {
                this.input = ref;
              }}
              placeholder={this.props.placeholder}
              value={this.props.value}
              onChange={this.props.onChange}
              onKeyUp={this.props.onKeyUp}
              onKeyDown={this.props.onKeyDown}
              onKeyPress={this.props.onKeyPress}
              onPaste={this.props.onPaste}
              onFocus={() => {
                if (this.props.onFocusChange) {
                  this.props.onFocusChange(true);
                }
              }}
              onBlur={() => {
                if (this.props.onFocusChange) {
                  this.props.onFocusChange(false);
                }
              }}
              autoFocus={this.props.autoFocus}
            />
          )}
          {!this.props.hideResult && this.state.currentList.length > 0 ? (
            <div
              className={
                'menu-list as_frame bg-white text-black dark:bg-zinc-900 dark:text-white rounded-lg inline ' +
                (this.state.focused && this.state.currentList.length ? 'fade_in ' : '') +
                this.state.resultPosition
              }
            >
              {this.state.currentList.map((item, index) => {
                return (
                  <div
                    key={index}
                    className={
                      'menu ' +
                      (!this.props.disableNavigationKey &&
                      item.autocomplete_id === this.state.selected
                        ? 'is_selected'
                        : '')
                    }
                    onClick={() => this.select(item)}
                  >
                    {item && this.props.renderItem[this.currentRegexUsed](item)}
                  </div>
                );
              })}
            </div>
          ) : (
            ''
          )}
        </div>
      </div>
    );
  }
}
