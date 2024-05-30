export default class Numbers {
  static unid() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }

  static humanFileSize(bytes: number, si: boolean) {
    const thresh = si ? 1000 : 1024;
    if (Math.abs(bytes) < thresh) {
      return bytes + ' B';
    }
    const units = si
      ? ['kb', 'mb', 'gb', 'gb', 'pb', 'eb', 'zb', 'yb']
      : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    do {
      bytes /= thresh;
      ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return `${bytes.toFixed(1)}${units[u]}`;
  }

  static hexToBase64(str: string) {
    return btoa(
      String.fromCharCode.apply(
        null,
        str
          .replace(/\r|\n/g, '')
          .replace(/([\da-fA-F]{2}) ?/g, '0x$1 ')
          .replace(/ +$/, '')
          .split(' ')
          .map(s => parseInt(s)),
      ),
    );
  }

  static timeuuidToDate(time_str: string) {
    if (!time_str) {
      return 0;
    }
    const uuid_arr = time_str.split('-');
    // eslint-disable-next-line no-redeclare
    time_str = [uuid_arr[2].substring(1), uuid_arr[1], uuid_arr[0]].join('');
    return parseInt(time_str, 16);
  }

  static compareTimeuuid(a?: string, b?: string) {
    return Numbers.timeuuidToDate(a || '') - Numbers.timeuuidToDate(b || '');
  }

  static minTimeuuid(a?: string, b?: string) {
    if (!a) return b || '';
    if (!b) return a || '';
    return (Numbers.compareTimeuuid(a, b) > 0 ? b : a) || '';
  }

  static maxTimeuuid(a?: string, b?: string) {
    if (!a) return b || '';
    if (!b) return a || '';
    return (Numbers.compareTimeuuid(a, b) > 0 ? a : b) || '';
  }

  static convertBases(src: string, srcAlphabet: string, dstAlphabet: string) {
    // orion elenzil
    // 20080905

    const getValueOfDigit = function (digit: string, alphabet: string) {
      const pos = alphabet.indexOf(digit);
      return pos;
    };

    const srcBase = srcAlphabet.length;
    const dstBase = dstAlphabet.length;

    let val = 0;
    let mlt = 1;

    while (src.length > 0) {
      const digit = src.charAt(src.length - 1);
      val += mlt * getValueOfDigit(digit, srcAlphabet);
      src = src.substring(0, src.length - 1);
      mlt *= srcBase;
    }

    let wetint = val;
    let ret = '';

    while (wetint >= dstBase) {
      const digitVal = wetint % dstBase;
      // eslint-disable-next-line no-redeclare
      const digit = dstAlphabet.charAt(digitVal);
      ret = digit + ret;
      wetint /= dstBase;
    }

    // eslint-disable-next-line no-redeclare
    const digit = dstAlphabet.charAt(wetint);
    ret = digit + ret;

    return ret;
  }
}

export const formatTime = (
  time: number | string,
  locale?: string,
  options: { keepTime?: boolean; keepSeconds?: boolean; keepDate?: boolean } = {
    keepTime: true,
  }
) => {
  time = new Date(time).getTime();
  locale = locale || navigator.language;
  const now = Date.now();
  const year = new Date(time).getFullYear();
  const nowYear = new Date(now).getFullYear();
  const day = 24 * 60 * 60 * 1000;
  return new Intl.DateTimeFormat(locale, {
    year: nowYear !== year || options?.keepDate ? "numeric" : undefined,
    month: now - time >= day || options?.keepDate ? "short" : undefined,
    day: now - time >= day || options?.keepDate ? "numeric" : undefined,
    hour: now - time < day || options?.keepTime ? "numeric" : undefined,
    minute: now - time < day || options?.keepTime ? "numeric" : undefined,
    second: options?.keepSeconds ? "numeric" : undefined,
  }).format(new Date(time));
};
export const formatDateShort = (time : number | string) => {
  const date = new Date(time);
  const padZero = (num :number) => num.toString().padStart(2, '0');

  const month = padZero(date.getMonth() + 1); // Months are zero-indexed
  const day = padZero(date.getDate());
  const year = date.getFullYear();
  const hours = padZero(date.getHours());
  const minutes = padZero(date.getMinutes());

  return `${day}.${month}.${year} ${hours}:${minutes}`;
};
