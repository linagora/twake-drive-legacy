import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import UserApi from "../common/user-api";
import config from "config";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
jest.mock("config");

describe("The Drive feature", () => {
  let platform: TestPlatform;
  let configHasSpy: jest.SpyInstance;
  let configGetSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Mocking config to disable manage access for the drive feature
    configHasSpy = jest.spyOn(config, "has");
    configGetSpy = jest.spyOn(config, "get");

    configHasSpy.mockImplementation((setting: string) => {
      return jest.requireActual("config").has(setting);
    });
    configGetSpy.mockImplementation((setting: string) => {
      if (setting === "drive.featureManageAccess") {
        return false; // Disable manage access
      }
      return jest.requireActual("config").get(setting);
    });

    // Initialize platform with required services
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
  });

  afterEach(async () => {
    // Tear down platform after each test
    await platform?.tearDown();
    platform = null;
  });

  it("Shared with me should not contain files when manage access is off", async () => {
    const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
    const anotherUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });

    // Upload files by the uploader user
    const files = await oneUser.uploadAllFilesOneByOne();

    // Wait for file processing
    await new Promise(r => setTimeout(r, 5000));

    // Share the file with recipient user
    await anotherUser.shareWithPermissions(files[1], anotherUser.user.id, "read");
    await new Promise(r => setTimeout(r, 3000)); // Wait for sharing process

    // Check if the shared file appears in recipient's "shared with me" section
    const sharedDocs = await anotherUser.browseDocuments("shared_with_me");

    // Validate that there are no shared files due to manage access being off
    expect(sharedDocs.children.length).toBe(0);
  });
});
