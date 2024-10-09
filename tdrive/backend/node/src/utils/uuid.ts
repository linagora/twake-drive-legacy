export function compareTimeuuid(a?: string, b?: string): number {
  return timeuuidToDate(a || "") - timeuuidToDate(b || "");
}

export function timeuuidToDate(time_str: string): number {
  if (!time_str) {
    return 0;
  }

  const uuid_arr = time_str.split("-");
  const time_string = [uuid_arr[2].substring(1), uuid_arr[1], uuid_arr[0]].join("");

  return parseInt(time_string, 16);
}

/** Remove `-`s from a formatted UUID to get a hex a string */
export function hexFromFormatted(uuid: string) {
  const result = uuid.replace(/-+/g, "");
  if (result.length !== 32)
    throw new Error(`Invalid UUID (${JSON.stringify(uuid)}). Wrong number of digits`);
  return result;
}

/** Add `-`s back in a hex string to make a formatted UUID */
export function formattedFromHex(hex: string) {
  const idMatch = hex.match(
    /^([a-z0-f]{8})([a-z0-f]{4})([a-z0-f]{4})([a-z0-f]{4})([a-z0-f]{12})$/i,
  );
  if (!idMatch)
    throw new Error(`Invalid UUID hex (${JSON.stringify(hex)}). Wrong number of digits`);
  const [, ...parts] = idMatch;
  return parts.join("-");
}

/** Convert a UUID formatted or hex string into a binary buffer */
export function bufferFromUUIDString(uuidOrHex: string) {
  return Buffer.from(hexFromFormatted(uuidOrHex), "hex");
}

/** In a buffer with concatenated UUIDs in binary, extract the `index`th and return as formatted UUID */
export function formattedUUIDInBufferArray(buffer: Buffer, index: number) {
  if (buffer.length < (index + 1) * 16)
    throw new Error(`Cannot get UUID ${JSON.stringify(index)} because the buffer is too small`);
  const slice = buffer.subarray(index * 16, (index + 1) * 16);
  return formattedFromHex(slice.toString("hex").toLowerCase());
}
