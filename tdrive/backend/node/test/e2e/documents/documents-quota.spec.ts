import { describe, beforeEach, it, expect, afterAll } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import UserApi from "../common/user-api";

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
  });
});
