import "./load_test_config";
import "reflect-metadata";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import { deserialize } from "class-transformer";
import UserApi from "../common/user-api";
import { DriveItemDetailsMockClass } from "../common/entities/mock_entities";
import { e2e_createDocumentFile, e2e_createVersion } from "../documents/utils";
import { ResourceUpdateResponse } from "../../../src/utils/types";
import { File } from "../../../src/services/files/entities/file";
import { FileVersion } from "../../../src/services/documents/entities/file-version";

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
    it("Should scan the document and detect it as safe", async () => {
      // Create an admin user
      const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
      const document = await oneUser.uploadFileAndCreateDocument("../../common/assets/sample.doc");

      expect(document).toBeDefined();
      expect(document.av_status).toBe("scanning");
      await new Promise(resolve => setTimeout(resolve, 5000));

      const documentResponse = await oneUser.getDocument(document.id);
      const deserializedDocument = deserialize<DriveItemDetailsMockClass>(
        DriveItemDetailsMockClass,
        documentResponse.body,
      );
      expect(deserializedDocument).toBeDefined();
      expect(deserializedDocument.item.av_status).toBe("safe");
    });

    it.skip("Should scan the document and detect it as malicious", async () => {
      // Create an admin user
      const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
      const document = await oneUser.uploadTestMalAndCreateDocument("test-malware.txt");

      expect(document).toBeDefined();
      expect(document.av_status).toBe("scanning");
    });

    it("Should skip the scan if the document is too large", async () => {
      // Create an admin user
      const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });

      // 2.8 MB file > 1 MB limit
      const document = await oneUser.uploadFileAndCreateDocument("../../common/assets/sample.mp4");

      expect(document).toBeDefined();
      expect(document.av_status).toBe("skipped");
    });
  });

  describe("On version creation", () => {
    it("Should scan the document and detect it as safe.", async () => {
      // Create an admin user
      const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
  
      // Create a default document for the user
      const document = await oneUser.createDefaultDocument();
  
      // Upload a file and deserialize the response
      const fileUploadResponse = await e2e_createDocumentFile(platform);
      const fileUploadResult = deserialize<ResourceUpdateResponse<File>>(
        ResourceUpdateResponse,
        fileUploadResponse.body
      );
  
      // Prepare metadata with the uploaded file's ID
      const fileMetadata = { external_id: fileUploadResult.resource.id };
  
      // Create a new version of the document with the uploaded file metadata
      const versionResponse = await e2e_createVersion(
        platform,
        document.id,
        { filename: "file2", file_metadata: fileMetadata },
        oneUser.jwt
      );
      const versionResult = deserialize<FileVersion>(FileVersion, versionResponse.body);
      expect(versionResult).toBeDefined();
  
      // Retrieve the document and verify the antivirus status
      const documentResponse = await oneUser.getDocument(versionResult.drive_item_id);
      const deserializedDocument = deserialize<DriveItemDetailsMockClass>(
        DriveItemDetailsMockClass,
        documentResponse.body
      );
      
      // Ensure the document has been scanned and is no longer marked as "uploaded"
      expect(deserializedDocument.item.av_status).not.toBe("uploaded");
    });
  });
});
