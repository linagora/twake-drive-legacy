import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import UserApi from "../common/user-api";
import config from "config";
import { e2e_createDocumentFile, e2e_createVersion } from "./utils";
import { deserialize } from "class-transformer";
import { ResourceUpdateResponse } from "../../../src/utils/types";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
jest.mock("config");

describe("the Drive feature", () => {
  let platform: TestPlatform;
  let currentUser: UserApi;
  let configHasSpy: jest.SpyInstance;
  let configGetSpy: jest.SpyInstance;

  beforeEach(async () => {
    configHasSpy = jest.spyOn(config, "has");
    configGetSpy = jest.spyOn(config, "get");

    configHasSpy.mockImplementation((setting: string) => {
      const value = jest.requireActual("config").has(setting);
      return value;
    });
    configGetSpy.mockImplementation((setting: string) => {
      if (setting === "drive.featureUserQuota") {
        return true;
      }
      if (setting === "drive.defaultUserQuota") {
        return 2000000;
      }
      return jest.requireActual("config").get(setting);
    });
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

  afterEach(async () => {
    await platform?.tearDown();
    platform = null;
    configGetSpy.mockRestore();
  });

  it("did create the drive item with size under quota", async () => {
    const result = await currentUser.uploadFileAndCreateDocument("sample.doc");
    console.log("result small file: ", result);
    expect(result).toBeDefined();
  });

  it("did not upload the drive item with size above quota", async () => {
    const result: any = await currentUser.uploadFileAndCreateDocument("sample.mp4");
    expect(result).toBeDefined();
    expect(result.statusCode).toBe(403);
    expect(result.error).toBe("Forbidden");
    expect(result.message).toContain("Not enough space");

    //TODO[ASH] check that the file was deleted
  });

  it("did create a version for a drive item", async () => {
    const item = await currentUser.createDefaultDocument();
    const fileUploadResponse = await e2e_createDocumentFile(
      platform,
      "../common/assets/sample.mp4",
    );
    const fileUploadResult: any = deserialize<ResourceUpdateResponse<File>>(
      ResourceUpdateResponse,
      fileUploadResponse.body,
    );
    const file_metadata = { external_id: fileUploadResult.resource.id };

    const result: any = await e2e_createVersion(platform, item.id, {
      filename: "file2",
      file_metadata,
    });
    expect(result).toBeDefined();
    expect(result.statusCode).toBe(403);
  });
});
