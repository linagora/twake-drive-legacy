import { expect, jest, describe, beforeEach, test } from "@jest/globals";
import { generateEncodedUrlComponents } from "../../../../../src/services/documents/utils";
import {
  NotificationActionType,
  NotificationPayloadType,
} from "../../../../../src/services/documents/types";

// Mock short-uuid
jest.mock("short-uuid", () => {
  const mockTranslator = {
    fromUUID: jest.fn((uuid: string) => `short-${uuid}`),
  };
  return jest.fn(() => mockTranslator);
});

describe("generateEncodedUrlComponents", () => {
  const receiver = "receiver-id";

  const mockItem = (overrides: Partial<NotificationPayloadType["item"]>) => ({
    company_id: "company-uuid",
    id: "item-id",
    parent_id: "parent-id",
    scope: "personal",
    is_directory: false,
    is_in_trash: false,
    ...overrides,
  });

  const mockPayload = (
    type: NotificationActionType,
    overrides: Partial<NotificationPayloadType> = {},
  ) => ({
    type,
    item: mockItem({}),
    notificationEmitter: "user_emitter-id",
    notificationReceiver: "user_receiver-id",
    context: {},
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("DIRECT action: user shares a directory or a file with another user", () => {
    test("should link to shared with me view for a shared directory", () => {
      const payload = mockPayload(NotificationActionType.DIRECT, {
        item: mockItem({ is_directory: true }) as any,
      });

      const expectedResult = [
        "client",
        "short-company-uuid",
        "v",
        "shared_with_me",
        "d",
        "item-id",
      ];

      const result = generateEncodedUrlComponents(payload as NotificationPayloadType, receiver);
      expect(result).toEqual(expectedResult);
    });

    test("should link to shared with me and preview for a shared file", () => {
      const payload = mockPayload(NotificationActionType.DIRECT);

      const expectedResult = [
        "client",
        "short-company-uuid",
        "v",
        "shared_with_me",
        "preview",
        "item-id",
      ];

      const result = generateEncodedUrlComponents(payload as NotificationPayloadType, receiver);
      expect(result).toEqual(expectedResult);
    });
  });

  describe("UPDATE action: user updates a direcotry or file shared with them, on twake drive or through public link", () => {
    test("should link to my drive view for a directory update", () => {
      const payload = mockPayload(NotificationActionType.UPDATE, {
        item: mockItem({ is_directory: true }) as any,
      });

      const expectedResult = [
        "client",
        "short-company-uuid",
        "v",
        "user_receiver-id",
        "d",
        "item-id",
      ];

      const result = generateEncodedUrlComponents(payload as NotificationPayloadType, receiver);
      expect(result).toEqual(expectedResult);
    });

    test("should link to my drive and preview for a file update", () => {
      const payload = mockPayload(NotificationActionType.UPDATE);

      const expectedResult = [
        "client",
        "short-company-uuid",
        "v",
        "user_receiver-id",
        "d",
        "parent-id",
        "preview",
        "item-id",
      ];

      const result = generateEncodedUrlComponents(payload as NotificationPayloadType, receiver);
      expect(result).toEqual(expectedResult);
    });
  });
});
