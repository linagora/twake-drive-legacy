import "./load_test_config";
import "reflect-metadata";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import { deserialize } from "class-transformer";
import UserApi from "../common/user-api";
import { DriveItemDetailsMockClass } from "../common/entities/mock_entities";

describe("The documents antivirus", () => {
  let platform: TestPlatform;
  let helpers: UserApi;

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
        "files",
        "auth",
        "statistics",
        "platform-services",
        "documents",
      ],
    });
  });

  afterAll(async () => {
    await platform?.tearDown();
    // @ts-ignore
    platform = null;
  });

  describe("On document create", () => {
    it("should scan the document and detect it as safe", async () => {
      const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
      const document = await oneUser.uploadFileAndCreateDocument("../../common/assets/sample.doc");

      expect(document).toBeDefined();
      expect(document.av_status).toBe("scanning");
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const documentResponse = await oneUser.getDocument(document.id);
      const deserializedDocument = deserialize<DriveItemDetailsMockClass>(
        DriveItemDetailsMockClass,
        documentResponse.body,
      );
      expect(deserializedDocument).toBeDefined();
      expect(deserializedDocument.item.av_status).toBe("safe");
    });

    it.skip("should scan the document and detect it as malicious", async () => {
      const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
      const document = await oneUser.uploadTestMalAndCreateDocument("test-malware.txt");

      expect(document).toBeDefined();
      expect(document.av_status).toBe("scanning");
    });

    it("should skip the scan if the document is too large", async () => {
      const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });

      // 2.8 MB file > 1 MB limit
      const document = await oneUser.uploadFileAndCreateDocument("../../common/assets/sample.mp4");

      expect(document).toBeDefined();
      expect(document.av_status).toBe("skipped");
    });
  });
});
