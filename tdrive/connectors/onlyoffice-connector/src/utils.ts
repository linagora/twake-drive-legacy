/** Return the key in `obj` of which the value matches the `value` parameter, or `undefined` */
export function getKeyForValue<T>(value: T, obj: any): string | undefined {
  return (Object.entries(obj as { [key: string]: T }).filter(([_key, entryValue]) => value === entryValue)[0] ?? [])[0];
}

/** Same as `getKeyForValue` but returns a default string for values not found */
export function getKeyForValueSafe<T>(value: T, obj: any, valueKind: string): string {
  const result = getKeyForValue(value, obj);
  return result ?? `(Unknown ${valueKind}: ${JSON.stringify(value)})`;
}

/** Suitable type for query arguments */
export type QueryParams = { [key: string]: string | number };

/** Compose a URL removing and adding slashes and query parameters as warranted */
export function joinURL(path: string[], params?: QueryParams) {
  let joinedPath = path.map(x => x.replace(/(?:^\/+)+|(?:\/+$)/g, "")).join("/");
  if (path[path.length - 1].endsWith("/"))
    joinedPath += "/";
  const paramEntries = Object.entries(params || {});
  if (paramEntries.length === 0)
    return joinedPath;
  const query = paramEntries.map((p) => p.map(encodeURIComponent).join("=")).join("&");
  return joinedPath + (joinedPath.indexOf("?") > -1 ? "&" : "?") + query;
}

/** Split a filename into an array `[name, extension]`. Either and both can be
 * the empty string. When the extension is the whole name, it is assumed to be
 * the name and not the extension.
 * @example
 * ```js
 * splitFilename("")             // [  "", "" ]
 * splitFilename(".")            // [ ".", "" ]
 * splitFilename("..")           // [ ".", "" ]
 * splitFilename("filename")     // [ "filename", "" ]
 * splitFilename(".dotfile")     // [ ".dotfile", "" ]
 * splitFilename("a.dotfile")    // [    "a", "dotfile" ]
 * splitFilename(".a.dotfile")   // [   ".a", "dotfile" ]
 * splitFilename("a.b.dotfile")  // [  "a.b", "dotfile" ]
 * splitFilename(".a.b.dotfile") // [ ".a.b", "dotfile" ]
 * ```
 */
export function splitFilename(filename: string): [string, string] {
  const parts = filename.split('.');
  if (parts.length < 2 || (parts.length == 2 && parts[0] === ""))
    return [filename, ""];
  const extension = parts.pop();
  return [parts.join("."), extension];
}
