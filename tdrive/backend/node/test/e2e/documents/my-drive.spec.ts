import { describe, beforeEach, afterEach, it, expect, afterAll } from "@jest/globals";
import { deserialize } from "class-transformer";
import { initWithDefaults, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import {
  e2e_updateDocument,
} from "./utils";
import UserApi from "../common/user-api";
import { DriveFile } from "../../../src/services/documents/entities/drive-file";

describe("the My Drive feature", () => {
  let platform: TestPlatform;
  let currentUser: UserApi;

  class DriveFileMockClass {
    id: string;
    name: string;
    size: number;
    added: string;
    parent_id: string;
    is_directory: boolean;
  }

  beforeEach(async () => {
    platform = await initWithDefaults();
    currentUser = await UserApi.getInstance(platform);
  });

  afterAll(async () => {
    await platform?.tearDown();
    platform = null;
  });

  const createItem = async (): Promise<DriveFile> => {
    await TestDbService.getInstance(platform, true);

    const item = {
      name: "new test file",
      parent_id: "user_" + platform.currentUser.id,
      company_id: platform.workspace.company_id,
    };

    return await currentUser.createDocument(item, {});
  };

  it("did create the drive item in my user folder", async () => {
    const result = await createItem();

    expect(result).toBeDefined();
    expect(result.name).toEqual("new test file");
    expect(result.added).toBeDefined();
  });

  it("did move an item to root and back", async () => {
    const createItemResult = await createItem();

    expect(createItemResult.id).toBeDefined();

    let updateItemResponse = await e2e_updateDocument(platform, createItemResult.id, {
      parent_id: "root",
    });
    let updateItemResult = deserialize<DriveFileMockClass>(
      DriveFileMockClass,
      updateItemResponse.body,
    );

    expect(createItemResult.id).toEqual(updateItemResult.id);
    expect(updateItemResult.parent_id).toEqual("root");

    updateItemResponse = await e2e_updateDocument(platform, createItemResult.id, {
      parent_id: "user_" + platform.currentUser.id,
    });
    updateItemResult = deserialize<DriveFileMockClass>(DriveFileMockClass, updateItemResponse.body);

    expect(createItemResult.id).toEqual(updateItemResult.id);
    expect(updateItemResult.parent_id).toEqual("user_" + platform.currentUser.id);
  });

  it("can't move an item to another user folder", async () => {
    const createItemResult = await createItem();

    expect(createItemResult.id).toBeDefined();

    let updateItemResponse = await e2e_updateDocument(platform, createItemResult.id, {
      parent_id: "user_2123",
    });

    expect(updateItemResponse.statusCode).not.toBe(200);
  });
});
