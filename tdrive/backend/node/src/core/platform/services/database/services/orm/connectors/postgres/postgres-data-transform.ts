import { ColumnType } from "../../../orm/types";
import { isBoolean, isInteger, isNull, isString, isUndefined } from "lodash";
import { decrypt, encrypt } from "../../../../../../../crypto";
import { logger } from "../../../../../../framework";

export type TransformOptions = {
  secret?: string;
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
  counter: "BIGINT",

  // backward compatibility
  tdrive_boolean: "BOOLEAN",
  tdrive_datetime: "BIGINT", //Deprecated
};

/**
 * Possible data transformations:
 *   string --> everything
 *   encoded_string --> everything
 *   json --> everything
 *   encoded_json --> everything
 *
 *   number --> number, string
 *   tdrive_int --> number, string
 *   tdrive_datetime --> number. string
 *
 *   timeuuid --> string
 *   uuid --> string
 *
 *   boolean --> boolean, number
 *   tdrive_boolean --> boolean, number
 *
 *   tdrive_datetime --> number
 *
 *   null and undefined --> null
 */
export class PostgresDataTransformer {
  constructor(readonly options: TransformOptions) {}

  fromDbString(v: any, type: ColumnType): any {
    if (isNull(v) || isUndefined(v)) {
      return null;
    }

    this.checkType(type);

    if (v !== null && (type === "encoded_string" || type === "encoded_json")) {
      let decryptedValue: string;

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

    if (type === "number" || type === "tdrive_datetime" || type === "counter") {
      const number = parseInt(v, 10);
      if (isNaN(number)) throw new Error(`Can't parse ${v} to int`);
      return number;
    }

    if (type === "json") {
      return JSON.parse(v);
    }

    return v;
  }

  toDbString(v: any, type: ColumnType): any {
    this.checkType(type);

    if (isNull(v) || isUndefined(v)) {
      return null;
    }

    if (type === "number" || type === "tdrive_datetime" || type === "counter") {
      const number = parseInt(v, 10);
      if (isNaN(number)) throw new Error(`Can't parse ${v} to int`);
      return number;
    }

    if (type === "uuid" || type === "timeuuid") {
      if (!isString(v))
        throw new Error(`uuid or timeuuid could be only strings, and ${v} is not string`);
      return v;
    }

    if (type === "boolean" || type === "tdrive_boolean") {
      //Security to avoid string with "false" in it
      if (!isInteger(v) && !isBoolean(v)) {
        throw new Error(`'${v}' is not a ${type}`);
      }
      return !!v;
    }

    if (type === "string") {
      if (isString(v)) return v;
      else throw "We can't store in string fields only strings";
    }

    if (type === "json") {
      return JSON.stringify(v);
    }

    if (type === "encoded_string" || type === "encoded_json") {
      if (type === "encoded_string" && !isString(v))
        throw "We can't store in string fields only strings";

      if (type === "encoded_json") {
        v = JSON.stringify(v);
      }
      const encrypted = encrypt(v, this.options.secret);
      return `${(encrypted.data || "").toString().replace(/'/gm, "''")}`;
    }

    return v.toString();
  }

  private checkType(type: ColumnType) {
    if (!Object.keys(TypeMappings).includes(type)) {
      throw new Error(`Support of ${type} not implemented yet for PostgreSQL`);
    }
  }
}
