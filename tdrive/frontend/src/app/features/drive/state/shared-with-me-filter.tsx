import { atom } from 'recoil';

export type SharedWithMeFilter = {
  mimeType: {
    key: string;
    value: string
  };
  creator: string;
  date: {
    key: string;
    value: string;
  };
};

export const SharedWithMeFilterState = atom<SharedWithMeFilter>({
  key: 'SharedWithMeFilterState',
  default: {
    mimeType: {
      key: '',
      value: ''
    },
    creator: '',
    date: {
      key: '',
      value: ''
    }
  },
});