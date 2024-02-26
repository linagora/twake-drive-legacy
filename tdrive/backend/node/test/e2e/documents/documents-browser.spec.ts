import { describe, beforeEach, afterEach, it, expect, afterAll } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import UserApi from "../common/user-api";

describe("The Documents Browser Window and API", () => {
  let platform: TestPlatform;
  let currentUser: UserApi;
  let dbService: TestDbService;

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
        "realtime",
        "statistics",
        "platform-services",
        "documents",
      ],
    });
    currentUser = await UserApi.getInstance(platform);
    dbService = await TestDbService.getInstance(platform, true);
  });

  afterAll(async () => {
    await platform?.tearDown();
    platform = null;
  });

  describe("My Drive", () => {

    it("Should successfully upload filed to the 'Shared Drive' and browse them", async () => {
      const myDriveId = "user_" + currentUser.user.id;
      const result = await currentUser.uploadAllFilesOneByOne(myDriveId);

      expect(result).toBeDefined();
      expect(result.entries()).toBeDefined();
      expect(Array.from(result.entries())).toHaveLength(UserApi.ALL_FILES.length);


      const docs = await currentUser.browseDocuments(myDriveId, {});
      expect(docs).toBeDefined();
      expect(docs.children).toBeDefined();
      expect(docs.children.length).toEqual(UserApi.ALL_FILES.length)
    });

    it("Should not be visible for other users", async () => {
      const myDriveId = "user_" + currentUser.user.id;
      const anotherUser = await UserApi.getInstance(platform, true, {companyRole: "admin"});
      await currentUser.uploadAllFilesOneByOne(myDriveId);
      await new Promise(r => setTimeout(r, 5000));

      const docs = await currentUser.browseDocuments(myDriveId, {});
      expect(docs).toBeDefined();
      expect(docs.children).toBeDefined();
      expect(docs.children.length).toEqual(UserApi.ALL_FILES.length)

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
    it("Shouldn't contain files uploaded to the user folder", async () => {
      const sharedWIthMeFolder = "shared_with_me";
      await currentUser.uploadAllFilesOneByOne("user_" + currentUser.user.id);
      await new Promise(r => setTimeout(r, 5000));

      let docs = await currentUser.browseDocuments(sharedWIthMeFolder, {});
      expect(docs).toBeDefined();
      expect(docs.children?.length).toEqual(0)

      await currentUser.uploadAllFilesOneByOne("root");
      docs = await currentUser.browseDocuments("shared_with_me", {});

      expect(docs).toBeDefined();
      expect(docs.children?.length).toEqual(0);
    });

    it("Should contain files that were shared with the user", async () => {
      const sharedWIthMeFolder = "shared_with_me";
      const oneUser = await UserApi.getInstance(platform, true, {companyRole: "admin"});
      const anotherUser = await UserApi.getInstance(platform, true, {companyRole: "admin"});
      let files = await oneUser.uploadAllFilesOneByOne();
      await new Promise(r => setTimeout(r, 5000));

      //then:: files are not searchable for user without permissions
      expect((await anotherUser.browseDocuments("shared_with_me", {})).children).toHaveLength(0);

      //give permissions to the file
      files[0].access_info.entities.push({
        type: "user",
        id: anotherUser.user.id,
        level: "read",
        grantor: null,
      });
      await oneUser.updateDocument(files[0].id, files[0]);
      await new Promise(r => setTimeout(r, 3000));

      //then file become searchable
      expect((await anotherUser.browseDocuments("shared_with_me", {pageSize: 1})).children).toHaveLength(1);
    });

    it("Share With Me should return all the files that was share by user at one", async () => {
      const sharedWIthMeFolder = "shared_with_me";
      const oneUser = await UserApi.getInstance(platform, true, {companyRole: "admin"});
      const anotherUser = await UserApi.getInstance(platform, true, {companyRole: "admin"});

      let files = await oneUser.uploadAllFilesOneByOne();

      await anotherUser.uploadAllFilesOneByOne();
      await new Promise(r => setTimeout(r, 5000));

      //give permissions to the file
      files[2].access_info.entities.push({
        type: "user",
        id: anotherUser.user.id,
        level: "read",
        grantor: null,
      });
      await oneUser.updateDocument(files[2].id, files[2]);
      await new Promise(r => setTimeout(r, 3000));

      //then file become searchable
      expect((await anotherUser.browseDocuments("shared_with_me", {pagination: {limitStr: 100}})).children).toHaveLength(1);
    });
  });
});

