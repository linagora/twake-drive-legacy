import "reflect-metadata";
import { expect, jest, test, describe, beforeEach, afterEach } from "@jest/globals";
import { randomUUID } from "crypto";
import { EditingSessionKeyFormat } from "../../../../../src/services/documents/entities/drive-file";

describe('DriveFile EditingSessionKeyFormat', () => {
  const mockAppId = 'tdrive_random_application_id';
  const mockCompanyId = randomUUID();
  const mockUserId = randomUUID();
  const mockInstanceId = "super-instance-id";
  const mockTimestamp = new Date();
  const mockTimestampWith0MS = mockTimestamp.getTime() - (mockTimestamp.getTime() % 1000);

  const checkIsUUID = (value: string) => {
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(value).not.toMatch(/^0{8}-0{4}-0{4}-0{4}-0{12}$/i);
  };

  const checkKeyIsOOCompatible = (key: string) => {
    // OnlyOffice key limits: see https://api.onlyoffice.com/editors/config/document#key
    expect(key).toMatch(/^[0-9a-zA-Z._=-]{1,128}$/);
  };

  test('generates a valid value that can be parsed', async () => {
    checkIsUUID(mockUserId);
    checkIsUUID(mockCompanyId);
    const key = EditingSessionKeyFormat.generate(mockAppId, mockInstanceId, mockCompanyId, mockUserId, mockTimestamp);
    checkKeyIsOOCompatible(key);
    const parsed = EditingSessionKeyFormat.parse(key);
    expect(parsed.applicationId).toBe(mockAppId);
    expect(parsed.instanceId).toBe(mockInstanceId);
    expect(parsed.userId).toBe(mockUserId);
    expect(parsed.companyId).toBe(mockCompanyId);
    expect(parsed.timestamp.getTime()).toBe(mockTimestampWith0MS);
  });

  test('generates unique values', async () => {
    const key = EditingSessionKeyFormat.generate(mockAppId, mockInstanceId, mockCompanyId, mockUserId, mockTimestamp);
    const key2 = EditingSessionKeyFormat.generate(mockAppId, mockInstanceId, mockCompanyId, mockUserId, mockTimestamp);
    expect(key).not.toBe(key2);
  });

  test('checks the appId', async () => {
    expect(() => {
      EditingSessionKeyFormat.generate('invalid app id !', mockInstanceId, mockCompanyId, mockUserId);
    }).toThrow('Invalid applicationId value');
  });

  test('checks final length', async () => {
    expect(() => {
      const tooLongAppID = new Array(100).join('x');
      EditingSessionKeyFormat.generate(tooLongAppID, mockInstanceId, mockCompanyId, mockUserId);
    }).toThrow('Must be <128 chars,');
  });
});