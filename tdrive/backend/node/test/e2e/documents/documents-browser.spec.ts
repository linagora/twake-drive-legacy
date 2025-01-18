import { describe, beforeEach, afterEach, it, expect, afterAll } from "@jest/globals";
import {initWithDefaults, TestPlatform } from "../setup";
import UserApi from "../common/user-api";

describe("The Documents Browser Window and API", () => {
  let platform: TestPlatform;
  let currentUser: UserApi;
  let sharedWIthMeFolder: string;
  let myDriveId: string;
  let files: any;

  beforeEach(async () => {
    platform = await initWithDefaults();
    currentUser = await UserApi.getInstance(platform);
    sharedWIthMeFolder = "shared_with_me";
    myDriveId = "user_" + currentUser.user.id;
    files = await currentUser.uploadAllFilesOneByOne(myDriveId);

    expect(files).toBeDefined();
    expect(files.entries()).toBeDefined();
    expect(Array.from(files.entries())).toHaveLength(UserApi.ALL_FILES.length);
  });

  afterEach(async () => {
    await platform?.tearDown();
    // @ts-ignore
    platform = null;
  });

  describe("My Drive", () => {
    it("Should successfully upload filed to the 'My Drive' and browse them", async () => {
      const docs = await currentUser.browseDocuments(myDriveId, {});
      expect(docs).toBeDefined();
      expect(docs.children).toBeDefined();
      expect(docs.children.length).toEqual(UserApi.ALL_FILES.length);
    });

    it("Should not be visible for other users", async () => {
      const anotherUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });

      const docs = await currentUser.browseDocuments(myDriveId, {});
      expect(docs).toBeDefined();
      expect(docs.children).toBeDefined();
      expect(docs.children.length).toEqual(UserApi.ALL_FILES.length);

      const anotherUserDocs = await anotherUser.searchDocument({});
      expect(anotherUserDocs).toBeDefined();
      expect(anotherUserDocs.entities).toBeDefined();
      expect(anotherUserDocs.entities.length).toEqual(0);
    });
  });

  describe("Shared Drive", () => {
    it("Should successfully upload filed to the 'Shared Drive' and browse them", async () => {
      const result = await currentUser.uploadAllFilesOneByOne("root");
      expect(result).toBeDefined();
      expect(result.entries()).toBeDefined();
      expect(Array.from(result.entries())).toHaveLength(UserApi.ALL_FILES.length);

      const docs = await currentUser.browseDocuments("root", {});
      expect(docs).toBeDefined();
      expect(docs.children).toBeDefined();
      expect(docs.children.length).toEqual(UserApi.ALL_FILES.length);
    });
  });

  describe("Shared With Me", () => {
    it("Shouldn't contain user personal files", async () => {
      let docs = await currentUser.browseDocuments(sharedWIthMeFolder, {});
      expect(docs).toBeDefined();
      expect(docs.children?.length).toEqual(0);

      await currentUser.uploadAllFilesOneByOne("root");
      docs = await currentUser.browseDocuments("shared_with_me", {});

      expect(docs).toBeDefined();
      expect(docs.children?.length).toEqual(0);
    });

    it("Should contain files that were shared with the user", async () => {
      const anotherUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });

      //then:: files are not searchable for user without permissions
      expect((await anotherUser.browseDocuments("shared_with_me", {})).children).toHaveLength(0);

      //give permissions to the file
      files[0].access_info.entities.push({
        type: "user",
        id: anotherUser.user.id,
        level: "read",
        grantor: null,
      });
      await currentUser.updateDocument(files[0].id, files[0]);
      await new Promise(r => setTimeout(r, 3000));

      //then file become searchable
      expect(
        (await anotherUser.browseDocuments("shared_with_me", { pageSize: 1 })).children,
      ).toHaveLength(1);
    });

    it("Should return ALL the files that was share by user at one", async () => {
      const anotherUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });

      //give permissions to the file
      files[2].access_info.entities.push({
        type: "user",
        id: anotherUser.user.id,
        level: "read",
        // @ts-ignore
        grantor: null,
      });
      await currentUser.updateDocument(files[2].id, files[2]);
      await new Promise(r => setTimeout(r, 3000));

      //then file become searchable
      expect(
        (await anotherUser.browseDocuments("shared_with_me", { pagination: { limitStr: 100 } }))
          .children,
      ).toHaveLength(1);
    });

    it("User should be able to delete file that was shared with him with 'manage' permissions", async () => {
      const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
      const anotherUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });

      let files = await oneUser.uploadAllFilesOneByOne("user_" + oneUser.user.id);
      await new Promise(r => setTimeout(r, 3000));

      let toDeleteDoc = files[2];
      toDeleteDoc.access_info.entities.push({
        type: "user",
        id: anotherUser.user.id,
        level: "manage",
        // @ts-ignore
        grantor: null,
      });
      await oneUser.updateDocument(toDeleteDoc.id, toDeleteDoc);

      const response = await anotherUser.delete(toDeleteDoc.id);
      expect(response.statusCode).toBe(200);
    });

    it("User should be able to delete folder with the files that was shared with him with 'manage' permissions", async () => {
      const oneUser = await UserApi.getInstance(platform, true);
      const anotherUser = await UserApi.getInstance(platform, true);

      const dir = await oneUser.createDirectory("user_" + oneUser.user.id);
      const level2Dir = await oneUser.createDirectory(dir.id);
      const level2Dir2 = await oneUser.createDirectory(dir.id);
      await oneUser.uploadAllFilesOneByOne(level2Dir.id);
      await oneUser.uploadAllFilesOneByOne(level2Dir2.id);
      await oneUser.uploadAllFilesOneByOne(dir.id);
      await new Promise(r => setTimeout(r, 3000));

      dir.access_info.entities.push({
        type: "user",
        id: anotherUser.user.id,
        level: "manage",
        // @ts-ignore
        grantor: null,
      });
      await oneUser.updateDocument(dir.id, dir);

      const response = await anotherUser.delete(dir.id);
      expect(response.statusCode).toBe(200);
    });

    it("Shouldn't return files that are in trash", async () => {
      const oneUser = await UserApi.getInstance(platform, true);
      const anotherUser = await UserApi.getInstance(platform, true);

      const dir = await oneUser.createDirectory("user_" + oneUser.user.id);

      dir.access_info.entities.push({
        type: "user",
        id: anotherUser.user.id,
        level: "manage",
        // @ts-ignore
        grantor: null,
      });
      await oneUser.updateDocument(dir.id, dir);
      await new Promise(r => setTimeout(r, 3000));

      //can brows files
      let sharedDocs = await anotherUser.browseDocuments("shared_with_me");
      expect(sharedDocs.children.length).toBe(1);

      //when
      const response = await anotherUser.delete(dir.id);
      expect(response.statusCode).toBe(200);
      await new Promise(r => setTimeout(r, 3000));

      sharedDocs = await anotherUser.browseDocuments("shared_with_me");
      expect(sharedDocs.children.length).toBe(0);
    });
  });
});
