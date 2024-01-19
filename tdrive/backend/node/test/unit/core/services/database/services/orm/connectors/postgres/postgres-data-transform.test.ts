
import {
  PostgresDataTransformer, TypeMappings
} from "../../../../../../../../../src/core/platform/services/database/services/orm/connectors/postgres/postgres-data-transform";
import { randomInt, randomUUID } from "crypto";
import { ColumnType } from "../../../../../../../../../src/core/platform/services/database/services/orm/types";
import { v4 } from "uuid";
import { DriveScope } from "../../../../../../../../../src/services/documents/entities/drive-file";

describe('The PostgresDataTransformer', () => {

  test('toDbString anything to counter, blob and other not implemented types should throw an error', async () => {
    //given
    const subj: PostgresDataTransformer = new PostgresDataTransformer({ secret: "" });

    //then
    expect(() => subj.toDbString(randomInt(1000), "blob")).toThrow(Error);
    expect(() => subj.toDbString(null, "blob")).toThrow(Error);
  });

  test.each(Object.keys(TypeMappings))('toDbString for "%s" and null or undefined --> to null', async (type: ColumnType) => {
    //given
    const subj: PostgresDataTransformer = new PostgresDataTransformer({ secret: "" });

    //then
    expect(subj.toDbString(null, type)).toBeNull();
    expect(subj.toDbString(undefined, type)).toBeNull();
  });

  test('toDbString for tdrive_int, tdrive_datetime should return the same number', async () => {
    //given
    const subj: PostgresDataTransformer = new PostgresDataTransformer({ secret: "" });
    const number = randomInt(1000);

    //then
    expect(subj.toDbString(number, "number")).toBe(number);
    expect(subj.toDbString(number, "counter")).toBe(number);
    expect(subj.toDbString(number, "tdrive_datetime")).toBe(number);
    expect(subj.toDbString(String(number), "tdrive_datetime")).toBe(number);
  });

  test('toDbString for tdrive_int, tdrive_datetime should throw error if its not a number', async () => {
    //given
    const subj: PostgresDataTransformer = new PostgresDataTransformer({ secret: "" });

    //then
    expect(() => subj.toDbString("", "number")).toThrow(Error);
    expect(() => subj.toDbString("str_" + randomUUID(), "tdrive_datetime")).toThrow(Error);
    expect(() => subj.toDbString(true, "tdrive_datetime")).toThrow(Error);
    expect(() => subj.toDbString({ idx: 1} , "tdrive_datetime")).toThrow(Error);
  });

  test('toDbString for uuid and timeuuid should throw exception if value is not string', async () => {
    //given
    const subj: PostgresDataTransformer = new PostgresDataTransformer({ secret: "" });

    //then
    expect(() => subj.toDbString({ }, "uuid")).toThrow(Error);
    expect(() => subj.toDbString({ }, "timeuuid")).toThrow(Error);
    expect(() => subj.toDbString(true, "uuid")).toThrow(Error);
    expect(() => subj.toDbString(1 , "timeuuid")).toThrow(Error);
  });

  test('toDbString for uuid and timeuuid should be transformed to the same string', async () => {
    //given
    const uuid = v4()
    const subj: PostgresDataTransformer = new PostgresDataTransformer({ secret: "" });

    //then
    expect(subj.toDbString(uuid, "uuid")).toBe(uuid);
    expect(subj.toDbString(uuid, "timeuuid")).toBe(uuid);
  });



  test('toDbString for boolean and to tdrive_boolean should return boolean', async () => {
    //given
    const subj: PostgresDataTransformer = new PostgresDataTransformer({ secret: "" });
    const number = randomInt(1000) + 1;

    //then
    expect(subj.toDbString(number, "tdrive_boolean")).toBe(true);
    expect(subj.toDbString(number, "boolean")).toBe(true);
    expect(subj.toDbString(0, "tdrive_boolean")).toBe(false);
    expect(subj.toDbString(-number, "boolean")).toBe(true);
    expect(subj.toDbString(true, "boolean")).toBe(true);
    expect(subj.toDbString(false, "boolean")).toBe(false);
  });

  test('toDbString for boolean and to tdrive_boolean should throw error for any not boolean', async () => {
    //given
    const subj: PostgresDataTransformer = new PostgresDataTransformer({ secret: "" });

    //then
    expect(() => subj.toDbString("true", "tdrive_boolean")).toThrow(Error);
    expect(() => subj.toDbString("true", "boolean")).toThrow(Error);
    expect(() => subj.toDbString("false", "tdrive_boolean")).toThrow(Error);
    expect(() => subj.toDbString("false", "boolean")).toThrow(Error);
    expect(() => subj.toDbString({ }, "boolean")).toThrow(Error);
    expect(() => subj.toDbString([true], "tdrive_boolean")).toThrow(Error);
  });


  test('toDbString for string should return boolean the result of toString() method', async () => {
    //given
    const scope: DriveScope = "personal";
    const subj: PostgresDataTransformer = new PostgresDataTransformer({ secret: "" });

    //then
    expect(subj.toDbString("test_string", "string")).toBe("test_string");
    expect(subj.toDbString(scope, "string")).toBe("personal");
  });

  test('toDbString for json should return stringified object', async () => {
    //given
    const file = { id: "123", amount: 10};
    const subj: PostgresDataTransformer = new PostgresDataTransformer({ secret: "" });

    //then
    expect(subj.toDbString(file, "json")).toBe('{"id":"123","amount":10}');
    expect(subj.toDbString(10, "json")).toBe("10");
  });

  test('toDbString for encoded_string and empty secret should return plain string', async () => {
    //given
    const str = randomUUID();
    const subj: PostgresDataTransformer = new PostgresDataTransformer({ secret: "" });

    //then
    expect(subj.toDbString(str, "encoded_string")).toBe(str);
  });

  test('toDbString for encoded_json and empty secret should return plain string', async () => {
    //then
    //given
    const file = { id: "123", amount: 10};
    const subj: PostgresDataTransformer = new PostgresDataTransformer({ secret: "" });

    //then
    expect(subj.toDbString(file, "encoded_json")).toBe('{"id":"123","amount":10}');
    expect(subj.toDbString(10, "encoded_json")).toBe("10");
  });

  test('toDbString for encoded_json should return decodable string different from the source one', async () => {
    //then
    //given
    const file = { id: "123", amount: 10};
    const subj: PostgresDataTransformer = new PostgresDataTransformer({ secret: "hey it's secret" });

    //then
    const encodedJson = subj.toDbString(file, "encoded_json");
    expect(encodedJson).not.toBe('{"id":"123","amount":10}');
    const encodedNumber = subj.toDbString(10, "encoded_json");
    expect(encodedNumber).not.toBe("10");

    expect(subj.fromDbString(encodedJson, "encoded_json")).toEqual(file);
    expect(subj.fromDbString(encodedNumber, "encoded_json")).toEqual(10);
  });

  test('toDbString for encoded_string should return decodable string different from the source one', async () => {
    //then
    //given
    const str = randomUUID();
    const subj: PostgresDataTransformer = new PostgresDataTransformer({ secret: "hey it's secret" });

    //then
    const encodedStr = subj.toDbString(str, "encoded_json");
    expect(encodedStr).not.toBe('{"id":"123","amount":10}');

    expect(subj.fromDbString(encodedStr, "encoded_json")).toEqual(str);
  });

});