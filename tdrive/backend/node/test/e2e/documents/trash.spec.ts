import { describe, beforeAll, it, expect, afterAll } from "@jest/globals";
import { deserialize } from "class-transformer";
import type { DriveFile } from "../../../src/services/documents/entities/drive-file";
import { init, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import UserApi from "../common/user-api";
import {
  DriveItemDetailsMockClass,
} from "../common/entities/mock_entities";

describe("the Drive's documents' trash feature", () => {
  let platform: TestPlatform | null;
  let currentUser: UserApi;

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

  it("did move an item to trash", async () => {
    const createItemResult = await currentUser.createDefaultDocument();

    expect(createItemResult.id).toBeDefined();

    const moveToTrashResponse = await currentUser.delete(createItemResult.id);
    expect(moveToTrashResponse.statusCode).toEqual(200);

    const listTrashResponse = await currentUser.getDocument("trash");
    const listTrashResult = deserialize<DriveItemDetailsMockClass>(
      DriveItemDetailsMockClass,
      listTrashResponse.body,
    );
    expect(listTrashResult.item.name).toEqual("Trash");
    expect(createItemResult).toBeDefined();
    expect(createItemResult.scope).toEqual("shared");
    expect(listTrashResult.children.some(({ id }) => id === createItemResult.id)).toBeTruthy();
  });

  describe("deleting a file uploaded by an anonymous user should go to the sharers trash", () => {
    async function getTrashContentIds() {
      const listTrashResponse = await currentUser.getDocument("trash");
      expect(listTrashResponse.statusCode).toBe(200);
      const listTrashResult = deserialize<DriveItemDetailsMockClass>(
        DriveItemDetailsMockClass,
        listTrashResponse.body,
      );
      return listTrashResult.children.map(({id}) => id);
    }

    async function uploadFileAsAnonymousUser(destinationSharedFolder: DriveFile) {
      const publicToken = await currentUser.getPublicLinkAccessToken(destinationSharedFolder);
      expect(publicToken?.value?.length ?? "").toBeGreaterThan(0);
      return await currentUser.impersonateWithJWT(publicToken.value, () =>
        currentUser.createDefaultDocument({
          parent_id: destinationSharedFolder.id,
        }));
    }

    it("finds the owner from the immediate parent folder", async () => {
      const publiclyWriteableFolder = await currentUser.createDirectory();
      const setPublicWriteableResponse = await currentUser.shareWithPublicLink(publiclyWriteableFolder, "write");
      expect(setPublicWriteableResponse.statusCode).toBe(200);

      const anonymouslyUploadedDoc = await uploadFileAsAnonymousUser(publiclyWriteableFolder);

      const deletionToTrashResponse = await currentUser.delete(anonymouslyUploadedDoc.id);
      expect(deletionToTrashResponse.statusCode).toBe(200);

      expect((await getTrashContentIds()).indexOf(anonymouslyUploadedDoc.id)).toBeGreaterThanOrEqual(0);
    });
  });
});