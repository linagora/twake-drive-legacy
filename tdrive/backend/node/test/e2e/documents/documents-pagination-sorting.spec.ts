import { describe, beforeAll, afterAll, it, expect } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import UserApi from "../common/user-api";

describe("The Documents Browser Window and API", () => {
  let platform: TestPlatform;
  let currentUser: UserApi;

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
        "files",
        "auth",
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

  describe("Pagination and Sorting", () => {
    
    it("Should paginate documents correctly", async () => {
      const myDriveId = "user_" + currentUser.user.id;
      await currentUser.uploadAllFilesOneByOne(myDriveId);

      let page = 1;
      const limit = 2;
      let docs = await currentUser.browseDocuments(myDriveId, {
        paginate: { page, limit },
      });
      expect(docs).toBeDefined();
      expect(docs.children).toHaveLength(limit);

      page = 2;
      docs = await currentUser.browseDocuments(myDriveId, {
        paginate: { page, limit },
      });
      expect(docs).toBeDefined();
      expect(docs.children).toHaveLength(limit);

      page = 3;
      docs = await currentUser.browseDocuments(myDriveId, {
        paginate: { page, limit },
      });
      expect(docs).toBeDefined();
      expect(docs.children.length).toBeLessThanOrEqual(limit);
    });

    it("Should sort documents by name in ascending order", async () => {
      const myDriveId = "user_" + currentUser.user.id;
      await currentUser.uploadAllFilesOneByOne(myDriveId);

      const sortBy = "name";
      const sortOrder = "asc";
      const docs = await currentUser.browseDocuments(myDriveId, {
        sort: { by: sortBy, order: sortOrder },
      });
      expect(docs).toBeDefined();

      const isSorted = docs.children.every((item, i, arr) => !i || arr[i - 1].name <= item.name);
      expect(isSorted).toBe(true);
    });

    it("Should sort documents by name in descending order", async () => {
      const myDriveId = "user_" + currentUser.user.id;
      await currentUser.uploadAllFilesOneByOne(myDriveId);

      const sortBy = "name";
      const sortOrder = "desc";
      const docs = await currentUser.browseDocuments(myDriveId, {
        sort: { by: sortBy, order: sortOrder },
      });
      expect(docs).toBeDefined();

      const isSorted = docs.children.every((item, i, arr) => !i || arr[i - 1].name >= item.name);
      expect(isSorted).toBe(true);
    });

    it("Should sort documents by date in ascending order", async () => {
      const myDriveId = "user_" + currentUser.user.id;
      await currentUser.uploadAllFilesOneByOne(myDriveId);

      const sortBy = "date";
      const sortOrder = "asc";
      const docs = await currentUser.browseDocuments(myDriveId, {
        sort: { by: sortBy, order: sortOrder },
      });
      expect(docs).toBeDefined();

      const isSorted = docs.children.every(
        (item, i, arr) => !i || new Date(arr[i - 1].added) <= new Date(item.added),
      );
      expect(isSorted).toBe(true);
    });

    it("Should sort documents by date in descending order", async () => {
      const myDriveId = "user_" + currentUser.user.id;
      await currentUser.uploadAllFilesOneByOne(myDriveId);

      const sortBy = "date";
      const sortOrder = "desc";
      const docs = await currentUser.browseDocuments(myDriveId, {
        sort: { by: sortBy, order: sortOrder },
      });
      expect(docs).toBeDefined();

      const isSorted = docs.children.every(
        (item, i, arr) => !i || new Date(arr[i - 1].added) >= new Date(item.added),
      );
      expect(isSorted).toBe(true);
    });

    it("Should sort documents by size in ascending order", async () => {
      const myDriveId = "user_" + currentUser.user.id;
      await currentUser.uploadAllFilesOneByOne(myDriveId);

      const sortBy = "size";
      const sortOrder = "asc";
      const docs = await currentUser.browseDocuments(myDriveId, {
        sort: { by: sortBy, order: sortOrder },
      });
      expect(docs).toBeDefined();

      const isSorted = docs.children.every((item, i, arr) => !i || arr[i - 1].size <= item.size);
      expect(isSorted).toBe(true);
    });

    it("Should sort documents by size in descending order", async () => {
      const myDriveId = "user_" + currentUser.user.id;
      await currentUser.uploadAllFilesOneByOne(myDriveId);

      const sortBy = "size";
      const sortOrder = "desc";
      const docs = await currentUser.browseDocuments(myDriveId, {
        sort: { by: sortBy, order: sortOrder },
      });
      expect(docs).toBeDefined();

      const isSorted = docs.children.every((item, i, arr) => !i || arr[i - 1].size >= item.size);
      expect(isSorted).toBe(true);
    });

    it("Should paginate shared with me ", async () => {
      const sharedWIthMeFolder = "shared_with_me";
      const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
      const anotherUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
      let files = await oneUser.uploadAllFilesOneByOne();
      for (const file of files) {
        await oneUser.shareWithPermissions(file, anotherUser.user.id, "read");
      }
      let page : any = "1";
      const limit = 2;
      let docs = await anotherUser.browseDocuments(sharedWIthMeFolder, {
        paginate: { page, limit },
      });
      console.log("🚀🚀 DOCS::1:: ", docs);
      expect(docs).toBeDefined();
      expect(docs.children).toHaveLength(limit);

      page = docs.nextPage?.page_token || "2";
      docs = await anotherUser.browseDocuments(sharedWIthMeFolder, {
        paginate: { page, limit },
      });
      console.log("🚀🚀 DOCS::2:: ", docs);
      expect(docs).toBeDefined();
      expect(docs.children).toHaveLength(limit);

      page = docs.nextPage?.page_token || "3";
      docs = await anotherUser.browseDocuments(sharedWIthMeFolder, {
        paginate: { page, limit },
      });
      console.log("🚀🚀 DOCS::3:: ", docs);
      expect(docs).toBeDefined();
      expect(docs.children.length).toBeLessThanOrEqual(limit);
    });

    it("Should sort shared with me by name in ascending order", async () => {
      const sharedWIthMeFolder = "shared_with_me";
      const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
      const anotherUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
      let files = await oneUser.uploadAllFilesOneByOne();
      for (const file of files) {
        await oneUser.shareWithPermissions(file, anotherUser.user.id, "read");
      }
      const sortBy = "name";
      const sortOrder = "asc";
      const docs = await anotherUser.browseDocuments(sharedWIthMeFolder, {
        sort: { by: sortBy, order: sortOrder },
      });
      expect(docs).toBeDefined();

      const isSorted = docs.children.every((item, i, arr) => !i || arr[i - 1].name <= item.name);
      expect(isSorted).toBe(true);
    });

    it("Should sort shared with me by name in descending order", async () => {
      const sharedWIthMeFolder = "shared_with_me";
      const oneUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
      const anotherUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
      let files = await oneUser.uploadAllFilesOneByOne();
      for (const file of files) {
        await oneUser.shareWithPermissions(file, anotherUser.user.id, "read");
      }
      const sortBy = "name";
      const sortOrder = "desc";
      const docs = await anotherUser.browseDocuments(sharedWIthMeFolder, {
        sort: { by: sortBy, order: sortOrder },
      });
      expect(docs).toBeDefined();

      const isSorted = docs.children.every((item, i, arr) => !i || arr[i - 1].name >= item.name);
      expect(isSorted).toBe(true);
    });
  });
});
