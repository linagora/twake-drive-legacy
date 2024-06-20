import { describe, beforeAll, beforeEach, it, expect, afterAll } from "@jest/globals";

import { init, TestPlatform } from "../setup";
import UserApi from "../common/user-api";

import { DriveFile, TYPE as DriveFileType } from "../../../src/services/documents/entities/drive-file";

describe("the Drive's documents' editing session kind-of-lock", () => {
  let platform: TestPlatform | null;
  let currentUser: UserApi;
  let currentUserRoot: string | undefined;
  let temporaryDocument: DriveFile;

  beforeAll(async () => {
    platform = await init({
      services: [
        "webserver",
        "database",
        "applications",
        "search",
        "storage",
        "message-queue",
        "user",
        "search",
        "files",
        "websocket",
        "messages",
        "auth",
        "realtime",
        "channels",
        "counter",
        "statistics",
        "platform-services",
        "documents",
      ],
    });
    currentUser = await UserApi.getInstance(platform);
    currentUserRoot = `user_${currentUser.user.id}`;
  });

  afterAll(async () => {
    await platform?.tearDown();
    platform = null;
  });

  beforeEach(async () => {
    temporaryDocument = await currentUser.createDefaultDocument({
      parent_id: currentUserRoot,
      scope: "personal",
    });
  });

  it("atomicCompareAndSet allows a single value at a time", async () => {
    const driveFileRepository = await platform?.database.getRepository<DriveFile>(DriveFileType, DriveFile);

    let result = await driveFileRepository?.atomicCompareAndSet(temporaryDocument, "editing_session_key", null, "123");
    expect(result).toEqual({ didSet:  true, currentValue: "123" });

    result = await driveFileRepository?.atomicCompareAndSet(temporaryDocument, "editing_session_key", null, "124");
    expect(result).toEqual({ didSet: false, currentValue: "123" });

    expect(driveFileRepository?.atomicCompareAndSet(temporaryDocument, "editing_session_key", "124", "124")).
      rejects.toThrow("Previous and new values are identical");

    result = await driveFileRepository?.atomicCompareAndSet(temporaryDocument, "editing_session_key", "122", "124");
    expect(result).toEqual({ didSet: false, currentValue: "123" });

    result = await driveFileRepository?.atomicCompareAndSet(temporaryDocument, "editing_session_key", "123", "124");
    expect(result).toEqual({ didSet:  true, currentValue: "124" });

    result = await driveFileRepository?.atomicCompareAndSet(temporaryDocument, "editing_session_key", "124", null);
    expect(result).toEqual({ didSet:  true, currentValue: null });

    temporaryDocument.id = "00000000-0000-0000-0000-000000000000";
    expect(driveFileRepository?.atomicCompareAndSet(temporaryDocument, "editing_session_key", "124", null)).
      rejects.toThrow("no row matched PK");
  });
});
