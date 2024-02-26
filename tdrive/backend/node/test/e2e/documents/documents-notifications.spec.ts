import { describe, beforeEach, it, expect, afterAll, jest } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import UserApi from "../common/user-api";
import { DocumentsEngine } from "../../../src/services/documents/services/engine";
import { deserialize } from "class-transformer";
import { File } from "../../../src/services/files/entities/file";
import { ResourceUpdateResponse } from "../../../src/utils/types";
import { e2e_createDocumentFile, e2e_createVersion } from "./utils";

describe("the Drive feature", () => {
  let platform: TestPlatform;
  const notifyDocumentShared = jest.spyOn(DocumentsEngine.prototype, "notifyDocumentShared");
  const notifyDocumentVersionUpdated = jest.spyOn(
    DocumentsEngine.prototype,
    "notifyDocumentVersionUpdated",
  );
  let currentUser: UserApi;

  beforeEach(async () => {
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
  });

  afterAll(async () => {
    await platform?.tearDown();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    platform = null;
  });

  it("Did notify the user after sharing a file.", async () => {
    // jest.setTimeout(20000);
    //given:: user uploaded one doc and give permission to another user
    const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
    const anotherUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
    //upload files
    const doc = await oneUser.uploadRandomFileAndCreateDocument();
    await new Promise(r => setTimeout(r, 3000));
    //give permissions to the file
    doc.access_info.entities.push({
      type: "user",
      id: anotherUser.user.id,
      level: "read",
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      grantor: null,
    });
    await oneUser.updateDocument(doc.id, doc);

    expect(notifyDocumentShared).toHaveBeenCalled();
  });

  it("Did notify the user after creating a new version for a file.", async () => {
    const item = await currentUser.createDefaultDocument();
    const fileUploadResponse = await e2e_createDocumentFile(platform);
    const fileUploadResult = deserialize<ResourceUpdateResponse<File>>(
      ResourceUpdateResponse,
      fileUploadResponse.body,
    );

    const file_metadata = { external_id: fileUploadResult.resource.id };

    await e2e_createVersion(platform, item.id, { filename: "file2", file_metadata });

    expect(notifyDocumentVersionUpdated).toHaveBeenCalled();
  });

  it("Did notify the owner after a user uploaded a file to a shared directory.", async () => {
    const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
    const anotherUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });

    const directory = await oneUser.createDirectory();
    directory.access_info.entities.push({
      type: "user",
      id: anotherUser.user.id,
      level: "write",
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      grantor: null,
    });

    await anotherUser.uploadRandomFileAndCreateDocument(directory.id);
    // expect the owner to be notified
    expect(notifyDocumentShared).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationEmitter: anotherUser.user.id,
        notificationReceiver: oneUser.user.id,
      }),
    );
  });
});
