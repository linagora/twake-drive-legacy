/** Suitable type for query arguments */
export type QueryParams = { [key: string]: string | number };

/**
 * Compose a URL removing and adding slashes and query parameters as warranted.
 * Does not encode paths.
 */
export function joinURL(path: string[], params?: QueryParams) {
  let joinedPath = path.map(x => x.replace(/(?:^\/+)|(?:\/+$)/g, "")).join("/");
  if (path[path.length - 1].endsWith("/")) joinedPath += "/";
  const paramEntries = Object.entries(params || {}).filter(
    ([, value]) => value !== undefined && value !== null,
  );
  if (paramEntries.length === 0) return joinedPath;
  const query = paramEntries.map(p => p.map(encodeURIComponent).join("=")).join("&");
  return joinedPath + (joinedPath.indexOf("?") > -1 ? "&" : "?") + query;
}
