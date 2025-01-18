import { describe, beforeEach, it, expect, afterAll, jest } from "@jest/globals";
import { initWithDefaults, TestPlatform } from "../setup";
import UserApi from "../common/user-api";
import * as utils from "../../../src/services/documents/utils";
import { DocumentsEngine } from "../../../src/services/documents/services/engine";
import EmailPusherClass from "../../../src/core/platform/services/email-pusher";
import { deserialize } from "class-transformer";
import { File } from "../../../src/services/files/entities/file";
import { ResourceUpdateResponse } from "../../../src/utils/types";
import { e2e_createDocumentFile, e2e_createVersion } from "./utils";

describe("the Drive feature", () => {
  let platform: TestPlatform;
  const isVirtualFolder = jest.spyOn(utils, "isVirtualFolder");
  const notifyDocumentShared = jest.spyOn(DocumentsEngine.prototype, "notifyDocumentShared");
  const notifyDocumentVersionUpdated = jest.spyOn(
    DocumentsEngine.prototype,
    "notifyDocumentVersionUpdated",
  );
  const DispatchDocumentEvent = jest.spyOn(DocumentsEngine.prototype, "DispatchDocumentEvent");
  const buildEmailSpy = jest.spyOn(EmailPusherClass.prototype, "build");
  let currentUser: UserApi;

  beforeEach(async () => {
    platform = await initWithDefaults();
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
    const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
    const oneUserJWT = await platform.auth.getJWTToken({ sub: oneUser.user.id });
    const fileUploadResponse = await e2e_createDocumentFile(platform);
    const fileUploadResult = deserialize<ResourceUpdateResponse<File>>(
      ResourceUpdateResponse,
      fileUploadResponse.body,
    );

    const file_metadata = { external_id: fileUploadResult.resource.id };

    await e2e_createVersion(platform, item.id, { filename: "file2", file_metadata }, oneUserJWT);

    expect(notifyDocumentVersionUpdated).toHaveBeenCalled();
  });

  it("Did notify the owner after a user uploaded a file to a shared directory.", async () => {
    const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
    const anotherUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
    const thridUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });

    const directory = await oneUser.createDirectory();
    directory.access_info.entities.push({
      type: "user",
      id: anotherUser.user.id,
      level: "write",
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      grantor: null,
    });

    directory.access_info.entities.push({
      type: "user",
      id: thridUser.user.id,
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
    // expect only one notification went through (the owner only notified)
    expect(notifyDocumentShared).not.toHaveBeenCalledWith(
      expect.objectContaining({
        notificationEmitter: oneUser.user.id,
        notificationReceiver: thridUser.user.id,
      }),
    );
  });

  it("Did not attempt to notify the user if the parent folder is a virutal folder.", async () => {    
    // upload a file
    const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
    const oneUserDrive = `user_${oneUser.user.id}`;
    await oneUser.uploadRandomFileAndCreateDocument(oneUserDrive);
    // expect the notification to not be sent
    expect(isVirtualFolder).toHaveBeenCalled();
    expect(isVirtualFolder).toHaveReturnedWith(true);
    expect(notifyDocumentShared).not.toHaveBeenCalledWith(
      expect.objectContaining({
        notificationEmitter: oneUser.user.id,
      }),
    );
  });

  // Test the email language based on the user's language and the email subject
  it("Did notify the user after sharing a file in the user's language.", async () => {
    const oneUser = await UserApi.getInstance(platform, true, {
      companyRole: "admin",
      preferences: { language: "en" },
    });
    const anotherUser = await UserApi.getInstance(platform, true, {
      companyRole: "admin",
      preferences: { language: "fr" },
    });
    //upload files
    const doc = await oneUser.uploadRandomFileAndCreateDocument();
    const doc2 = await anotherUser.uploadRandomFileAndCreateDocument();

    // shared the file
    await oneUser.shareWithPermissions(doc, anotherUser.user.id, "read");

    // expect the email to be sent in the receiver's language "fr"
    expect(buildEmailSpy).toHaveBeenCalledWith(
      // ignore the template name
      expect.any(String),
      // expect the language to be the receiver's language
      anotherUser.user.preferences?.language || "fr",
      // ignore the email context
      expect.any(Object),
    );

    // do the same for the other user
    await anotherUser.shareWithPermissions(doc2, oneUser.user.id, "read");

    // expect the email to be sent in the receiver's language "en"
    expect(buildEmailSpy).toHaveBeenCalledWith(
      // ignore the template name
      expect.any(String),
      // expect the language to be the receiver's language
      anotherUser.user.preferences?.language || "en",
      // ignore the email context
      expect.any(Object),
    );
  });
});
