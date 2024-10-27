import { ColumnOptions, ColumnType } from "../../types";
import { decrypt, encrypt } from "../../../../../../../crypto";
import { isNull } from "lodash";
import { fromMongoDbOrderable, toMongoDbOrderable } from "../../utils";

type TransformOptions = {
  secret?: any;
  disableSalts?: boolean;
  columns?: ColumnOptions;
  column?: any;
};

export const transformValueToDbString = (
  v: any,
  type: ColumnType,
  options: TransformOptions = {},
): any => {
  if (type === "timeuuid") {
    if (isNull(v) || !v) {
      return null;
    }
    //Convert to orderable number on mongodb
    return toMongoDbOrderable(v);
  }

  if (type === "uuid") {
    return `${v}`;
  }

  if (type === "encoded_string" || type === "encoded_json") {
    if (type === "encoded_json") {
      try {
        v = JSON.stringify(v);
      } catch (err) {
        v = null;
      }
    }
    if (v !== undefined) {
      v = encrypt(v, options.secret, { disableSalts: options.disableSalts }).data;
    }
    return v;
  }
  if (type === "blob") {
    return ""; //Not implemented yet
  }
  if (type === "string" || type === "json") {
    if (type === "json") {
      try {
        v = JSON.stringify(v);
      } catch (err) {
        v = null;
      }
    }
    return v;
  }

  if (type === "tdrive_boolean") {
    return Boolean(v);
  }

  if (type === "counter") {
    if (isNaN(v)) throw new Error("Counter value should be a number");
    return +v;
  }

  if (type === "number") {
    if (v === 0) return v;
  }

  return v || "";
};

export const transformValueFromDbString = (v: any, type: string, options: any = {}): any => {
  if (type === "timeuuid") {
    return fromMongoDbOrderable(v);
  }
  if (v !== null && (type === "encoded_string" || type === "encoded_json")) {
    try {
      v = decrypt(v, options.secret).data;
    } catch (err) {
      v = v;
    }
    if (type === "encoded_json") {
      try {
        return JSON.parse(v);
      } catch (err) {
        return null;
      }
    }
  }
  if (type === "json") {
    try {
      return JSON.parse(v);
    } catch (err) {
      return null;
    }
  }
  if (type === "tdrive_boolean" || type === "boolean") {
    return Boolean(v).valueOf();
  }
  if (type === "number") {
    return Number(v).valueOf();
  }

  if (type === "counter") {
    return new Number(v).valueOf();
  }

  return v;
};
