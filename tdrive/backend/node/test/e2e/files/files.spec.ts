import "reflect-metadata";
import { afterAll, beforeAll, afterEach, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import { getFilePath } from "../../../src/services/files/services";
import UserApi from "../common/user-api";
import LocalConnectorService from "../../../src/core/platform/services/storage/connectors/local/service"
import { Client as MinioClient } from "minio"
import { toInteger } from "lodash";

describe("The Files feature", () => {
  const url = "/internal/services/files/v1";
  let platform: TestPlatform;
  let helpers: UserApi;

  beforeAll(async () => {
    platform = await init({
      services: ["webserver", "database", "storage", "files", "previews"],
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await platform.database.getConnector().init();
    helpers = await UserApi.getInstance(platform);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await platform?.tearDown();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    platform = null;
  });

  describe("On user send files", () => {
    const thumbnails = [1, 1, 2, 5, 0, 1];

    it("Download file should return 500 if file doesn't exists", async () => {
      //given file
      const fileUpload = await helpers.uploadRandomFile();
      expect(fileUpload.id).toBeTruthy();
      // expect(platform.storage.getConnector()).toBeInstanceOf(S3ConnectorService);
      const path = `${getFilePath(fileUpload)}/chunk1`;
      await platform.storage.getConnector().remove(path);
      //when try to download the file
      const fileDownloadResponse = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${platform.workspace.company_id}/files/${fileUpload.id}/download`,
      });
      //then file should be not found with 404 error and "File not found message"
      expect(fileDownloadResponse).toBeTruthy();
      expect(fileDownloadResponse.statusCode).toBe(500);
    });

    it("should fail an upload POST when the backend storage fails", async () => {
      const thrower = () => {
        throw new Error("<Mock error done on purpose on upload to storage (for the E2E test)>");
      };
      const writeS3Mock = jest.spyOn(MinioClient.prototype, "putObject").mockImplementation(thrower);
      const writeLocalMock = jest.spyOn(LocalConnectorService.prototype, "write").mockImplementation(thrower);

      // expect(response.statusCode).toBe(500);
      await expect(helpers.uploadRandomFile()).rejects.toThrow("Error code: 500");

      // expect(response.statusCode).toBe(500);
      expect(writeS3Mock.mock.calls.length + writeLocalMock.mock.calls.length).toEqual(1);
    });

    it("Download file should return 200 if file exists", async () => {
      //given file
      const filesUpload = await helpers.uploadRandomFile();
      expect(filesUpload.id).toBeTruthy();
      //clean files directory
      // expect(platform.storage.getConnector()).toBeInstanceOf(S3ConnectorService);

      //when try to download the file
      const fileDownloadResponse = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${platform.workspace.company_id}/files/${filesUpload.id}/download`,
      });
      expect(fileDownloadResponse).toBeTruthy();
      expect(fileDownloadResponse.statusCode).toBe(200);
      //check the content length header that it's not empty
      expect(fileDownloadResponse.headers["content-length"]).toBeDefined();
      let length = toInteger(fileDownloadResponse.headers["content-length"]);
      expect(length).toBeGreaterThan(0)
      //and data is in place
      expect((fileDownloadResponse.stream().read(100) as Buffer).length).toBeGreaterThanOrEqual(100)
    });

    it.skip("should save file and generate previews", async () => {
      for (const i in UserApi.ALL_FILES) {
        const file = UserApi.ALL_FILES[i];

        const filesUpload = await helpers.uploadFile(file);

        expect(filesUpload.id).not.toBeFalsy();
        expect(filesUpload.encryption_key).toBeFalsy(); //This must not be disclosed
        expect(filesUpload.thumbnails.length).toBe(thumbnails[i]);

        for (const thumb of filesUpload.thumbnails) {
          const thumbnails = await platform.app.inject({
            headers: { authorization: `Bearer ${await platform.auth.getJWTToken()}` },
            method: "GET",
            url: `${url}/companies/${platform.workspace.company_id}/files/${filesUpload.id}/thumbnails/${thumb.index}`,
          });
          expect(thumbnails.statusCode).toBe(200);
        }
      }
    });
  });
});
