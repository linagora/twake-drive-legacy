import { describe, beforeAll, beforeEach, it, expect, afterAll, jest } from "@jest/globals";

import { init, TestPlatform } from "../setup";
import UserApi from "../common/user-api";

import { DriveFile, TYPE as DriveFileType } from "../../../src/services/documents/entities/drive-file";
import ApplicationsApiService, { ApplicationEditingKeyStatus } from "../../../src/services/applications-api";
import { afterEach } from "node:test";
import Application from "../../../src/services/applications/entities/application";

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
    jest.spyOn(ApplicationsApiService.getDefault(), 'getApplicationConfig').mockImplementation((id) => id === "e2e_testing" ? {} as Application : undefined);
    jest.spyOn(ApplicationsApiService.getDefault(), 'checkPendingEditingStatus').mockImplementation(async () => ApplicationEditingKeyStatus.unknown);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('rejects invalid editorApplicationId', async () => {
    let result = await currentUser.beginEditingDocument(temporaryDocument.id, '');
    expect(result.statusCode).toBe(400);
    result = await currentUser.beginEditingDocument(temporaryDocument.id, 'e2e-testing');
    expect(result.statusCode).toBe(400);
    result = await currentUser.beginEditingDocument(temporaryDocument.id, 'e2e_testing_but_this_one_is_likely_too_long_the_max_is_128_with_added_guid_and_ts_added_after_and_counting_towards_128');
    expect(result.statusCode).toBe(400);
  });

  it('can begin an editing session on a document only once', async () => {
    const editingSessionKey = await currentUser.beginEditingDocumentExpectOk(temporaryDocument.id, 'e2e_testing');
    const secondKey = await currentUser.beginEditingDocumentExpectOk(temporaryDocument.id, 'e2e_testing');
    expect(editingSessionKey).toBe(secondKey);
    const document = await currentUser.getDocumentOKCheck(temporaryDocument.id)
    expect(document.item.editing_session_key).toBe(editingSessionKey);
  });

  it('cannot begin an editing session on a document without write permissions', async () => {
    const secondUser = await UserApi.getInstance(platform!, true);
    const editingResult = await secondUser.beginEditingDocument(temporaryDocument.id, 'e2e_testing');
    expect(editingResult.statusCode).toBe(401);
  });

  it('can retreive the document from the editing session key', async () => {
    const editingSessionKey = await currentUser.beginEditingDocumentExpectOk(temporaryDocument.id, 'e2e_testing');
    let foundDocumentResult = await currentUser.getDocumentByEditingKey(editingSessionKey + "-made-wrong");
    expect(foundDocumentResult.statusCode).toBe(404);
    foundDocumentResult = await currentUser.getDocumentByEditingKey("");
    expect(foundDocumentResult.statusCode).toBe(400);
    foundDocumentResult = await currentUser.getDocumentByEditingKey(editingSessionKey);
    expect(foundDocumentResult.statusCode).toBe(200);
    expect(temporaryDocument.id).toBe(foundDocumentResult.json().id);
  });

  it('can cancel an editing session on a document only once with the right key', async () => {
    //given
    const editingSessionKey = await currentUser.beginEditingDocumentExpectOk(temporaryDocument.id, 'e2e_testing');
    //when
    const response = await currentUser.cancelEditingDocument(editingSessionKey);
    //then
    expect(response.statusCode).toBe(200);
    const newSessionKey = await currentUser.beginEditingDocumentExpectOk(temporaryDocument.id, 'e2e_testing');
    expect(newSessionKey).not.toEqual(editingSessionKey);
  });

  it('can end editing with a new version of document', async () => {
    //given
    const editingSessionKey = await currentUser.beginEditingDocumentExpectOk(temporaryDocument.id, 'e2e_testing');
    //when
    const response = await currentUser.updateEditingDocument(editingSessionKey);

    //then
    expect(response.statusCode).toBe(200);
    const document = await currentUser.getDocumentOKCheck(temporaryDocument.id);
    expect(document.versions.length).toEqual(2);
  });


});
