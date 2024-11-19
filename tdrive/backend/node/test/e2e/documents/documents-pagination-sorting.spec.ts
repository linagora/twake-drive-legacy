import { describe, beforeAll, afterAll, it, expect } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import UserApi from "../common/user-api";

describe("The Documents Browser Window and API", () => {
  let sharedWIthMeFolder: string;
  let platform: TestPlatform;
  let currentUser: UserApi;
  let anotherUser: UserApi;
  let myDriveId: string;
  let files: any;

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
    currentUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
    anotherUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
    myDriveId = "user_" + currentUser.user.id;
    sharedWIthMeFolder = "shared_with_me";
    files = await currentUser.uploadAllFilesOneByOne(myDriveId);
    for (const file of files) {
      await currentUser.shareWithPermissions(file, anotherUser.user.id, "read");
    }
  });

  afterAll(async () => {
    await platform?.tearDown();
    // @ts-ignore
    platform = null;
  });

  describe("Pagination and Sorting", () => {
    it("Should paginate documents correctly", async () => {
      let page_token = "1";
      const limitStr = "2";
      let docs = await currentUser.browseDocuments(myDriveId, {
        paginate: { page_token, limitStr },
      });
      expect(docs).toBeDefined();
      expect(docs.children).toHaveLength(parseInt(limitStr));

      page_token = "2";
      docs = await currentUser.browseDocuments(myDriveId, {
        paginate: { page_token, limitStr },
      });
      expect(docs).toBeDefined();
      expect(docs.children).toHaveLength(parseInt(limitStr));

      page_token = "3";
      docs = await currentUser.browseDocuments(myDriveId, {
        paginate: { page_token, limitStr },
      });
      expect(docs).toBeDefined();
      expect(docs.children).toHaveLength(parseInt(limitStr));
    });

    it("Should sort documents by name in ascending order", async () => {
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
      let page_token: any = "1";
      const limitStr = "2";

      await new Promise(resolve => setTimeout(resolve, 3000));

      let docs = await anotherUser.browseDocuments(sharedWIthMeFolder, {
        paginate: { page_token, limitStr },
      });
      expect(docs).toBeDefined();
      expect(docs.children).toHaveLength(parseInt(limitStr));

      page_token = docs.nextPage?.page_token || "2";
      docs = await anotherUser.browseDocuments(sharedWIthMeFolder, {
        paginate: { page_token, limitStr },
      });
      expect(docs).toBeDefined();
      expect(docs.children).toHaveLength(parseInt(limitStr));

      page_token = docs.nextPage?.page_token || "3";
      docs = await anotherUser.browseDocuments(sharedWIthMeFolder, {
        paginate: { page_token, limitStr },
      });
      expect(docs).toBeDefined();
      expect(docs.children.length).toBeLessThanOrEqual(parseInt(limitStr));
    });

    it("Should sort shared with me by name in ascending order", async () => {
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
      const sortBy = "name";
      const sortOrder = "desc";
      const docs = await anotherUser.browseDocuments(sharedWIthMeFolder, {
        sort: { by: sortBy, order: sortOrder },
      });
      expect(docs).toBeDefined();

      const isSorted = docs.children.every((item, i, arr) => !i || arr[i - 1].name >= item.name);
      expect(isSorted).toBe(true);
    });

    it("Should sort shared with me by size in ascending order", async () => {
      const sortBy = "size";
      const sortOrder = "asc";
      const docs = await anotherUser.browseDocuments(sharedWIthMeFolder, {
        sort: { by: sortBy, order: sortOrder },
      });
      expect(docs).toBeDefined();

      const isSorted = docs.children.every((item, i, arr) => !i || arr[i - 1].size <= item.size);
      expect(isSorted).toBe(true);
    });

    it("Should sort shared with me by size in descending order", async () => {
      const sortBy = "size";
      const sortOrder = "desc";
      const docs = await anotherUser.browseDocuments(sharedWIthMeFolder, {
        sort: { by: sortBy, order: sortOrder },
      });
      expect(docs).toBeDefined();

      const isSorted = docs.children.every((item, i, arr) => !i || arr[i - 1].size >= item.size);
      expect(isSorted).toBe(true);
    });

    it("Should sort shared with me by date in ascending order", async () => {
      const sortBy = "date";
      const sortOrder = "asc";
      const docs = await anotherUser.browseDocuments(sharedWIthMeFolder, {
        sort: { by: sortBy, order: sortOrder },
      });
      expect(docs).toBeDefined();

      const isSorted = docs.children.every(
        (item, i, arr) => !i || new Date(arr[i - 1].added) <= new Date(item.added),
      );
      expect(isSorted).toBe(true);
    });

    it("Should sort shared with me by date in descending order", async () => {
      const sortBy = "date";
      const sortOrder = "desc";
      const docs = await anotherUser.browseDocuments(sharedWIthMeFolder, {
        sort: { by: sortBy, order: sortOrder },
      });
      expect(docs).toBeDefined();

      const isSorted = docs.children.every(
        (item, i, arr) => !i || new Date(arr[i - 1].added) >= new Date(item.added),
      );
      expect(isSorted).toBe;
    });
  });
});
