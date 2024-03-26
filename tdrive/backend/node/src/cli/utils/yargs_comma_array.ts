import _ from "lodash";

/** Take potentially repeated string yarg arguments and make into garanteed string array; comma separated and whitespace trimed */
export default function parseYargsCommaSeparatedStringArray(
  args: undefined | string | string[],
): string[] {
  return _.uniq(
    (typeof args === "string" ? [args] : ((args || []) as string[]))
      .join(",")
      .split(",")
      .map(x => (x || "").trim())
      .filter(x => x),
  );
}
