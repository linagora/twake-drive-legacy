import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { deserialize } from "class-transformer";
import { AccessInformation, DriveFile } from "../../../src/services/documents/entities/drive-file";
import { FileVersion } from "../../../src/services/documents/entities/file-version";
import { DriveFileAccessLevel, DriveItemDetails } from "../../../src/services/documents/types";
import { init, TestPlatform } from "../setup";
import { e2e_updateDocument } from "./utils";
import UserApi from "../common/user-api";
import { AccessTokenMockClass } from "../common/entities/mock_entities";

const url = "/internal/services/documents/v1";

describe("the public links feature", () => {
  let platform: TestPlatform;
  let currentUser: UserApi;

  class DriveFileMockClass {
    id: string;
    name: string;
    size: number;
    added: number;
    parent_id: string;
    company_id: string;
    access_info: AccessInformation;
  }

  class FullDriveInfoMockClass {
    path: DriveFile[];
    item?: DriveFile;
    versions?: FileVersion[];
    children: DriveFile[];
    access: DriveFileAccessLevel | "none";
  }

  beforeAll(async () => {
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

  describe("Basic Flow", () => {
    let publicFile: DriveFileMockClass;

    it("did create the drive item", async () => {
      const result = await currentUser.createDefaultDocument();
      publicFile = result;

      expect(result).toBeDefined();
      expect(result.name).toEqual("new test file");
      expect(result.added).toBeDefined();
      expect(result.access_info).toBeDefined();
    });

    it("unable to access non public file", async () => {
      const res = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${publicFile.company_id}/item/${publicFile.id}?public_token=${publicFile.access_info.public?.token}`,
        headers: {},
      });

      expect(res.statusCode).toBe(401);
    });

    it("should access public file", async () => {
      const res = await e2e_updateDocument(platform, publicFile.id, {
        ...publicFile,
        access_info: {
          ...publicFile.access_info,
          public: {
            ...publicFile.access_info.public!,
            level: "read",
          },
        },
      });
      expect(res.statusCode).toBe(200);
      const file = deserialize<DriveFileMockClass>(DriveFileMockClass, res.body);
      expect(file.access_info.public?.level).toBe("read");

      const accessRes = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${publicFile.company_id}/anonymous/token`,
        headers: {},
        payload: {
          company_id: publicFile.company_id,
          document_id: publicFile.id,
          token: publicFile.access_info.public?.token,
        },
      });
      const { access_token } = deserialize<AccessTokenMockClass>(
        AccessTokenMockClass,
        accessRes.body,
      );
      expect(access_token).toBeDefined();

      const resPublicRaw = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${publicFile.company_id}/item/${publicFile.id}`,
        headers: {
          Authorization: `Bearer ${access_token.value}`,
        },
      });
      const resPublic = deserialize<DriveItemDetails>(FullDriveInfoMockClass, resPublicRaw.body);
      expect(resPublicRaw.statusCode).toBe(200);
      expect(resPublic.item?.id).toBe(publicFile.id);
    });

    it("unable to access expired public file link", async () => {
      await e2e_updateDocument(platform, publicFile.id, {
        ...publicFile,
        access_info: {
          ...publicFile.access_info,
          public: {
            ...publicFile.access_info.public!,
            level: "read",
            expiration: Date.now() + 1000 * 60, //In the future
          },
        },
      });

      const accessRes = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${publicFile.company_id}/anonymous/token`,
        headers: {},
        payload: {
          company_id: publicFile.company_id,
          document_id: publicFile.id,
          token: publicFile.access_info.public?.token,
        },
      });
      const { access_token } = deserialize<AccessTokenMockClass>(
        AccessTokenMockClass,
        accessRes.body,
      );

      let resPublicRaw = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${publicFile.company_id}/item/${publicFile.id}`,
        headers: {
          Authorization: `Bearer ${access_token.value}`,
        },
      });
      const resPublic = deserialize<DriveItemDetails>(FullDriveInfoMockClass, resPublicRaw.body);
      expect(resPublicRaw.statusCode).toBe(200);
      expect(resPublic.item?.id).toBe(publicFile.id);

      await e2e_updateDocument(platform, publicFile.id, {
        ...publicFile,
        access_info: {
          ...publicFile.access_info,
          public: {
            ...publicFile.access_info.public!,
            level: "read",
            expiration: 123, //In the past
          },
        },
      });

      resPublicRaw = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${publicFile.company_id}/item/${publicFile.id}`,
        headers: {
          authorization: `Bearer ${access_token.value}`,
        },
      });
      expect(resPublicRaw.statusCode).toBe(401);

      await e2e_updateDocument(platform, publicFile.id, {
        ...publicFile,
        access_info: {
          ...publicFile.access_info,
          public: {
            ...publicFile.access_info.public!,
            level: "read",
            expiration: 0, //Reset to default
          },
        },
      });
    });

    it("access public file link with password", async () => {
      await e2e_updateDocument(platform, publicFile.id, {
        ...publicFile,
        access_info: {
          ...publicFile.access_info,
          public: {
            ...publicFile.access_info.public!,
            level: "read",
            password: "abcdef",
          },
        },
      });

      const badAccessRes = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${publicFile.company_id}/anonymous/token`,
        headers: {},
        payload: {
          company_id: publicFile.company_id,
          document_id: publicFile.id,
          token: publicFile.access_info.public?.token,
        },
      });
      expect(badAccessRes.statusCode).toBe(401);

      const accessRes = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${publicFile.company_id}/anonymous/token`,
        headers: {},
        payload: {
          company_id: publicFile.company_id,
          document_id: publicFile.id,
          token: publicFile.access_info.public?.token,
          token_password: "abcdef",
        },
      });
      const { access_token } = deserialize<AccessTokenMockClass>(
        AccessTokenMockClass,
        accessRes.body,
      );

      let resPublicRaw = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${publicFile.company_id}/item/${publicFile.id}`,
        headers: {
          Authorization: `Bearer ${access_token.value}`,
        },
      });
      let resPublic = deserialize<DriveItemDetails>(FullDriveInfoMockClass, resPublicRaw.body);
      expect(resPublicRaw.statusCode).toBe(200);
      expect(resPublic.item?.id).toBe(publicFile.id);

      await e2e_updateDocument(platform, publicFile.id, {
        ...publicFile,
        access_info: {
          ...publicFile.access_info,
          public: {
            ...publicFile.access_info.public!,
            level: "read",
            password: "",
          },
        },
      });
    });
  });

  describe("Download Folder from shared link", () => {
    it("Share folder", async () => {
      const user = await UserApi.getInstance(platform, true);
      const anotherUser = await UserApi.getInstance(platform, true);

      //create directory in "My Drive" and upload a file
      const directory = await user.createDirectory("user_" + user.user.id);
      const doc = await user.createRandomDocument(directory.id);

      //check that another user doesn't see any file
      //expect((await anotherUser.getFolder(doc.id)).statusCode).toBe(401);

      //share folder with the public link
      await user.shareWithPublicLink(directory, "read");

      const token = await anotherUser.getPublicLinkAccessToken(directory);

      anotherUser.jwt = token.value;
      await anotherUser.getDocumentOKCheck(doc.id);

      expect((await anotherUser.zipDocument(doc.id)).statusCode).toBe(200);
    });
  });
});
