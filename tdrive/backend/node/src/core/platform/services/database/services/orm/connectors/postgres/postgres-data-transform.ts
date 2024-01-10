import { ColumnType } from "../../../orm/types";
import { isBoolean, isInteger, isNull, isUndefined } from "lodash";
import { decrypt, encrypt } from "../../../../../../../crypto";
import { logger } from "../../../../../../framework";

export type TransformOptions = {
  secret?: any;
};

export const TypeMappings = {
  encoded_string: "TEXT",
  encoded_json: "TEXT",
  json: "TEXT",
  string: "TEXT",
  number: "BIGINT",
  timeuuid: "UUID",
  uuid: "UUID",
  boolean: "BOOLEAN",

  // backward compatibility
  tdrive_boolean: "BOOLEAN",
  tdrive_datetime: "BIGINT", //Deprecated
};

export class PostgresDataTransformer {
  constructor(readonly options: TransformOptions) {}

  fromDbString(v: any, type: string): any {
    logger.trace(`Transform value %o of type ${type}`, v);

    if (type === "tdrive_datetime") {
      return new Date(`${v}`).getTime();
    }

    if (v !== null && (type === "encoded_string" || type === "encoded_json")) {
      let decryptedValue: any;

      if (typeof v === "string" && v.trim() === "") {
        return v;
      }

      try {
        decryptedValue = decrypt(v, this.options.secret).data;
      } catch (err) {
        logger.debug(`Can not decrypt data (${err.message}) %o of type ${type}`, v);

        decryptedValue = v;
      }

      if (type === "encoded_json") {
        try {
          decryptedValue = JSON.parse(decryptedValue);
        } catch (err) {
          logger.debug(
            { err },
            `Can not parse JSON from decrypted data %o of type ${type}`,
            decryptedValue,
          );
          decryptedValue = null;
        }
      }

      return decryptedValue;
    }

    if (type === "tdrive_boolean" || type === "boolean") {
      return Boolean(v).valueOf();
    }

    if (type === "json") {
      try {
        return JSON.parse(v);
      } catch (err) {
        return null;
      }
    }

    if (type === "uuid" || type === "timeuuid") {
      return v ? String(v).valueOf() : null;
    }

    if (type === "number") {
      return Number(v).valueOf();
    }

    if (type === "counter") {
      return Number(v).valueOf();
    }

    return v;
  }

  toDbString(v: any, type: ColumnType): any {
    if (type === "number" || type === "tdrive_int" || type === "tdrive_datetime") {
      if (isNull(v) || isNaN(v)) {
        return "null";
      }
      return parseInt(v);
    }
    if (type === "uuid" || type === "timeuuid") {
      if (isNull(v)) {
        return null;
      }
      return (v || "").toString();
    }
    if (type === "boolean" || type === "tdrive_boolean") {
      //Security to avoid string with "false" in it
      if (!isInteger(v) && !isBoolean(v) && !isNull(v) && !isUndefined(v)) {
        throw new Error(`'${v}' is not a ${type}`);
      }
      return !!v;
    }
    if (type === "encoded_string" || type === "encoded_json") {
      if (type === "encoded_json") {
        try {
          v = JSON.stringify(v);
        } catch (err) {
          v = null;
        }
      }
      const encrypted = encrypt(v, this.options.secret);
      return `${(encrypted.data || "").toString().replace(/'/gm, "''")}`;
    }
    if (type === "string" || type === "json") {
      if (type === "json" && v !== null) {
        try {
          v = JSON.stringify(v);
        } catch (err) {
          v = null;
        }
      }
      return (v || "").toString();
    }

    if (type === "blob" || type === "counter") {
      throw new Error("Not implemented yet");
    }
    return (v || "").toString();
  }
}
