import { describe, beforeAll, it, expect, afterAll } from "@jest/globals";
import { deserialize } from "class-transformer";

import { init, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import UserApi from "../common/user-api";
import {
  DriveItemDetailsMockClass,
} from "../common/entities/mock_entities";

describe("the Drive's documents' trash feature", () => {
  let platform: TestPlatform | null;
  let currentUser: UserApi;
  let currentUserRoot: string | undefined;
  let currentUserTrash: string | undefined;

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
    currentUserTrash = `trash_${currentUser.user.id}`;
  });

  afterAll(async () => {
    await platform?.tearDown();
    platform = null;
  });

  it("did fetch the trash", async () => {
    await TestDbService.getInstance(platform!, true);

    const response = await currentUser.getDocument("trash");
    const result = deserialize<DriveItemDetailsMockClass>(DriveItemDetailsMockClass, response.body);

    expect(result.item.id).toEqual("trash");
    expect(result.item.name).toEqual("Trash");
  });

  async function getTrashContentIds(scope: "shared" | "personal") {
    const id = scope === "shared" ? "trash" : currentUserTrash!;
    const listTrashResponse = await currentUser.getDocument(id);
    expect(listTrashResponse.statusCode).toBe(200);
    const listTrashResult = deserialize<DriveItemDetailsMockClass>(
      DriveItemDetailsMockClass,
      listTrashResponse.body,
    );
    expect(listTrashResult.item.id).toEqual(id);
    if (scope === "shared")
      expect(listTrashResult.item.name).toEqual("Trash");
    return listTrashResult.children.map(({id}) => id);
  }

  it("did move a shared item to shared trash", async () => {
    const createItemResult = await currentUser.createDefaultDocument();

    expect(createItemResult).toBeDefined();
    expect(createItemResult.id).toBeDefined();
    expect(createItemResult.scope).toEqual("shared");

    expect(await getTrashContentIds("shared")).not.toContain(createItemResult.id);

    const moveToTrashResponse = await currentUser.delete(createItemResult.id);
    expect(moveToTrashResponse.statusCode).toEqual(200);

    expect(await getTrashContentIds("shared")).toContain(createItemResult.id);
    expect(await getTrashContentIds("personal")).not.toContain(createItemResult.id);
  });

  it("did move a user item to user trash", async () => {
    const createItemResult = await currentUser.createDefaultDocument({
      parent_id: currentUserRoot,
      scope: "personal",
    });

    expect(createItemResult).toBeDefined();
    expect(createItemResult.id).toBeDefined();
    expect(createItemResult.scope).toEqual("personal");

    expect(await getTrashContentIds("personal")).not.toContain(createItemResult.id);

    const moveToTrashResponse = await currentUser.delete(createItemResult.id);
    expect(moveToTrashResponse.statusCode).toEqual(200);

    expect(await getTrashContentIds("personal")).toContain(createItemResult.id);
    expect(await getTrashContentIds("shared")).not.toContain(createItemResult.id);
  });

  describe("deleting a file uploaded by an anonymous user should go to the personal trash of the creator of the shared folder", () => {
    it("finds the owner from the immediate shared parent folder", async () => {
      const publiclyWriteableFolder = await currentUser.createDirectory(currentUserRoot, { scope: "personal" });
      const setPublicWriteableResponse = await currentUser.shareWithPublicLink(publiclyWriteableFolder, "write");
      expect(setPublicWriteableResponse.statusCode).toBe(200);

      const anonymouslyUploadedDoc = await currentUser.impersonatePublicLinkAccessOf(publiclyWriteableFolder, () =>
        currentUser.createDefaultDocument({
          parent_id: publiclyWriteableFolder.id,
          scope: "personal",
        }));
      expect(publiclyWriteableFolder.creator).toEqual(currentUser.user.id);
      expect(anonymouslyUploadedDoc.creator).not.toEqual(currentUser.user.id);

      const deletionToTrashResponse = await currentUser.delete(anonymouslyUploadedDoc.id);
      expect(deletionToTrashResponse.statusCode).toBe(200);

      expect((await getTrashContentIds("personal"))).toContain(anonymouslyUploadedDoc.id);
    });

    it("finds the owner from the indirect shared parent folder", async () => {
      const publiclyWriteableFolder = await currentUser.createDirectory(currentUserRoot, { scope: "personal" });
      const setPublicWriteableResponse = await currentUser.shareWithPublicLink(publiclyWriteableFolder, "write");
      expect(setPublicWriteableResponse.statusCode).toBe(200);

      const anonymouslyUploadedDoc = await currentUser.impersonatePublicLinkAccessOf(publiclyWriteableFolder, async () => {
        const anonymouslyCreatedFolder = await currentUser.createDirectory(publiclyWriteableFolder.id);
        expect(anonymouslyCreatedFolder.creator).not.toEqual(currentUser.user.id);
        return currentUser.createDefaultDocument({
          parent_id: anonymouslyCreatedFolder.id,
          scope: "personal",
        });
      });
      expect(publiclyWriteableFolder.creator).toEqual(currentUser.user.id);
      expect(anonymouslyUploadedDoc.creator).not.toEqual(currentUser.user.id);

      const deletionToTrashResponse = await currentUser.delete(anonymouslyUploadedDoc.id);
      expect(deletionToTrashResponse.statusCode).toBe(200);

      expect((await getTrashContentIds("personal"))).toContain(anonymouslyUploadedDoc.id);
    });

    it("goes into the creator of the shared folder s trash even if another user deletes the file", async () => {
      const publiclyWriteableFolder = await currentUser.createDirectory(currentUserRoot, { scope: "personal" });
      const setPublicWriteableResponse = await currentUser.shareWithPublicLink(publiclyWriteableFolder, "write");
      expect(setPublicWriteableResponse.statusCode).toBe(200);

      const anonymouslyUploadedDoc = await currentUser.impersonatePublicLinkAccessOf(publiclyWriteableFolder, () =>
        currentUser.createDefaultDocument({
          parent_id: publiclyWriteableFolder.id,
          scope: "personal",
        }));

      const secondaryUser = await UserApi.getInstance(platform!, true);

      let deletionToTrashResponse = await secondaryUser.delete(anonymouslyUploadedDoc.id);
      expect(deletionToTrashResponse.statusCode).toBe(500);

      // The following depends on inheriting permissions being the default behaviour (subject to change in the future)
      const changeRightsResponse = await currentUser.shareWithPermissions(publiclyWriteableFolder, secondaryUser.user.id, "manage");
      expect(changeRightsResponse.statusCode).toBe(200);

      deletionToTrashResponse = await secondaryUser.delete(anonymouslyUploadedDoc.id);
      expect(deletionToTrashResponse.statusCode).toBe(200);

      expect((await getTrashContentIds("personal"))).toContain(anonymouslyUploadedDoc.id);
    });
  });
});