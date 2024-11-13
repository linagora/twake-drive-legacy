import "./load_test_config"
import "reflect-metadata";
import { afterAll, beforeAll, afterEach, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import UserApi from "../common/user-api";
import LocalConnectorService from "../../../src/core/platform/services/storage/connectors/local/service"
import { StorageConnectorAPI } from "../../../src/core/platform/services/storage/provider";

describe("The OneOf Storage feature", () => {
  const url = "/internal/services/files/v1";
  let platform: TestPlatform;
  let helpers: UserApi;

  beforeAll(async () => {
    platform = await init({
      services: ["webserver", "database", "storage", "files", "previews"],
    });
    helpers = await UserApi.getInstance(platform);
  }, 300000000);

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await platform?.tearDown();
    platform = null;
  });

  describe("On file upload", () => {

    it("should fail an upload POST when ALL backend storage fails", async () => {
      const thrower = () => {
        throw new Error("<Mock error done on purpose on upload to storage (for the E2E test)>");
      };
      const writeLocalMock = jest.spyOn(LocalConnectorService.prototype, "write").mockRejectedValue("Error");

      // expect(response.statusCode).toBe(500);
      await expect(helpers.uploadRandomFile()).rejects.toThrow("Error code: 500");

      // expect(response.statusCode).toBe(500);
      expect(writeLocalMock.mock.calls.length).toEqual(2);
    });

    it("should successfully upload file when one backend storage fails", async () => {
      const thrower = () => {
        throw new Error("<Mock error done on purpose on upload to storage (for the E2E test)>");
      };

      const connectors = (platform.storage.getConnector() as any).storages as Array<StorageConnectorAPI>;

      const writeLocalMock = jest.spyOn(connectors[0], "write").mockRejectedValue("Error");

      // expect(response.statusCode).toBe(200);
      const filesUpload = await helpers.uploadRandomFile();
      expect(filesUpload.id).toBeTruthy();

      // expect failed upload
      expect(writeLocalMock.mock.calls.length).toBeGreaterThan(0);
      //expect that file can be downloaded
      const fileDownloadResponse = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${platform.workspace.company_id}/files/${filesUpload.id}/download`,
      });
      expect(fileDownloadResponse).toBeTruthy();
      expect(fileDownloadResponse.statusCode).toBe(200);

    });

  });
});
