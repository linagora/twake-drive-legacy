import { describe, beforeEach, it, expect, afterAll } from "@jest/globals";
import { deserialize } from "class-transformer";
import { File } from "../../../src/services/files/entities/file";
import { ResourceUpdateResponse } from "../../../src/utils/types";
import { init, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import {
  e2e_createDocumentFile,
  e2e_createVersion,
  e2e_updateDocument,
} from "./utils";
import UserApi from "../common/user-api";
import {
  DriveFileMockClass,
  DriveItemDetailsMockClass,
} from "../common/entities/mock_entities";

describe("the Drive feature", () => {
  let platform: TestPlatform;
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
        "messages",
        "auth",
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


  it("did create the drive item", async () => {
    const result = await currentUser.createDefaultDocument();

    expect(result).toBeDefined();
    expect(result.name).toEqual("new test file");
    expect(result.added).toBeDefined();
  });

  it("did fetch the drive item", async () => {
    await TestDbService.getInstance(platform, true);

    const response = await currentUser.getDocument("");
    const result = deserialize<DriveItemDetailsMockClass>(DriveItemDetailsMockClass, response.body);

    expect(result.item.id).toEqual("root");
    expect(result.item.name).toEqual("Shared Drive");
  });

  it("did delete an item", async () => {
    const createItemResult = await currentUser.createDefaultDocument();

    expect(createItemResult.id).toBeDefined();

    const deleteResponse = await currentUser.delete(createItemResult.id);
    expect(deleteResponse.statusCode).toEqual(200);
  });

  it("did update an item", async () => {
    const createItemResult = await currentUser.createDefaultDocument();

    expect(createItemResult.id).toBeDefined();

    const update = {
      name: "somethingelse",
    };

    const updateItemResponse = await e2e_updateDocument(platform, createItemResult.id, update);
    const updateItemResult = deserialize<DriveFileMockClass>(
      DriveFileMockClass,
      updateItemResponse.body,
    );

    expect(createItemResult.id).toEqual(updateItemResult.id);
    expect(updateItemResult.name).toEqual("somethingelse");
  });

  it("Download folder as a zip should work fine", async () => {
    //given
    const folder = await currentUser.createDirectory("user_" + currentUser.user.id)
    await currentUser.uploadRandomFileAndCreateDocument(folder.id);

    //when
    const zipResponse = await currentUser.zipDocument(folder.id);

    //then
    expect(zipResponse).toBeTruthy();
    expect(zipResponse.statusCode).toBe(200);

    //and data is in place
    expect(zipResponse.body.length).toBeGreaterThanOrEqual(100);
  });

  it("did create a version for a drive item", async () => {
    const item = await currentUser.createDefaultDocument();
    const fileUploadResponse = await e2e_createDocumentFile(platform);
    const fileUploadResult = deserialize<ResourceUpdateResponse<File>>(
      ResourceUpdateResponse,
      fileUploadResponse.body,
    );

    const file_metadata = { external_id: fileUploadResult.resource.id };

    await e2e_createVersion(platform, item.id, { filename: "file2", file_metadata });
    await e2e_createVersion(platform, item.id, { filename: "file3", file_metadata });
    await e2e_createVersion(platform, item.id, { filename: "file4", file_metadata });

    const fetchItemResponse = await currentUser.getDocument(item.id);
    const fetchItemResult = deserialize<DriveItemDetailsMockClass>(
      DriveItemDetailsMockClass,
      fetchItemResponse.body,
    );

    expect(fetchItemResult.versions).toHaveLength(4);
  });

});
