import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import { getFilePath } from "../../../src/services/files/services";
import UserApi from "../common/user-api";

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
    }, 120000);

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
      //then file should be not found with 404 error and "File not found message"
      expect(fileDownloadResponse).toBeTruthy();
      expect(fileDownloadResponse.statusCode).toBe(200);
    }, 120000);

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
    }, 1200000);
  });
});
