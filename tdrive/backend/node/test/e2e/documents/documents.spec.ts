import { describe, beforeEach, it, expect, afterAll } from "@jest/globals";
import { deserialize } from "class-transformer";
import { File } from "../../../src/services/files/entities/file";
import { ResourceUpdateResponse } from "../../../src/utils/types";
import { init, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import {
  e2e_createDocument,
  e2e_createDocumentFile,
  e2e_createVersion,
  e2e_deleteDocument,
  e2e_getDocument,
  e2e_searchDocument,
  e2e_updateDocument,
} from "./utils";
import TestHelpers from "../common/common_test_helpers";
import {
  DriveFileMockClass,
  DriveItemDetailsMockClass,
  SearchResultMockClass,
} from "../common/entities/mock_entities";

describe("the Drive feature", () => {
  let platform: TestPlatform;
  let currentUser: TestHelpers;
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
        "search",
        "files",
        "websocket",
        "messages",
        "auth",
        "realtime",
        "channels",
        "counter",
        "statistics",
        "platform-services",
        "documents",
      ],
    });
    currentUser = await TestHelpers.getInstance(platform);
    dbService = await TestDbService.getInstance(platform, true);
  }, 300000000);

  afterAll(async () => {
    await platform?.tearDown();
    platform = null;
  });

  const createItem = async (): Promise<DriveFileMockClass> => {
    await TestDbService.getInstance(platform, true);

    const item = {
      name: "new test file",
      parent_id: "root",
      company_id: platform.workspace.company_id,
    };

    const version = {};

    const response = await e2e_createDocument(platform, item, version);
    return deserialize<DriveFileMockClass>(DriveFileMockClass, response.body);
  };

  it("did create the drive item", async () => {
    const result = await createItem();

    expect(result).toBeDefined();
    expect(result.name).toEqual("new test file");
    expect(result.added).toBeDefined();
  });

  it("did fetch the drive item", async () => {
    await TestDbService.getInstance(platform, true);

    const response = await e2e_getDocument(platform, "");
    const result = deserialize<DriveItemDetailsMockClass>(DriveItemDetailsMockClass, response.body);

    expect(result.item.id).toEqual("root");
    expect(result.item.name).toEqual("Shared Drive");
  });

  it("did fetch the trash", async () => {
    await TestDbService.getInstance(platform, true);

    const response = await e2e_getDocument(platform, "trash");
    const result = deserialize<DriveItemDetailsMockClass>(DriveItemDetailsMockClass, response.body);

    expect(result.item.id).toEqual("trash");
    expect(result.item.name).toEqual("Trash");
  });

  it("did delete an item", async () => {
    const createItemResult = await createItem();

    expect(createItemResult.id).toBeDefined();

    const deleteResponse = await e2e_deleteDocument(platform, createItemResult.id);
    expect(deleteResponse.statusCode).toEqual(200);
  });

  it("did update an item", async () => {
    const createItemResult = await createItem();

    expect(createItemResult.id).toBeDefined();

    const update = {
      name: "somethingelse",
    };

    const updateItemResponse = await e2e_updateDocument(platform, createItemResult.id, update);
    const updateItemResult = deserialize<DriveFileMockClass>(
      DriveFileMockClass,
      updateItemResponse.body,
    );

    expect(createItemResult.id).toEqual(updateItemResult.id);
    expect(updateItemResult.name).toEqual("somethingelse");
  });

  it("did move an item to trash", async () => {
    const createItemResult = await createItem();

    expect(createItemResult.id).toBeDefined();

    const moveToTrashResponse = await e2e_deleteDocument(platform, createItemResult.id);
    expect(moveToTrashResponse.statusCode).toEqual(200);

    const listTrashResponse = await e2e_getDocument(platform, "trash");
    const listTrashResult = deserialize<DriveItemDetailsMockClass>(
      DriveItemDetailsMockClass,
      listTrashResponse.body,
    );

    expect(listTrashResult.item.name).toEqual("Trash");
    expect(listTrashResult.children.some(({ id }) => id === createItemResult.id)).toBeTruthy();
  });

  it("did search for an item", async () => {
    jest.setTimeout(10000);
    const createItemResult = await createItem();

    expect(createItemResult.id).toBeDefined();

    await e2e_getDocument(platform, "root");
    await e2e_getDocument(platform, createItemResult.id);

    await new Promise(resolve => setTimeout(resolve, 3000));

    const searchPayload = {
      search: "test",
    };

    const searchResponse = await e2e_searchDocument(platform, searchPayload);
    const searchResult = deserialize<SearchResultMockClass>(
      SearchResultMockClass,
      searchResponse.body,
    );

    expect(searchResult.entities.length).toBeGreaterThanOrEqual(1);
  });

  it("did search for an item and check that all the fields for 'shared_with_me' view", async () => {
    jest.setTimeout(20000);
    //given:: user uploaded one doc and give permission to another user
    const oneUser = await TestHelpers.getInstance(platform, true);
    const anotherUser = await TestHelpers.getInstance(platform, true);
    //upload files
    const doc = await oneUser.uploadRandomFileAndCreateDocument();
    await new Promise(r => setTimeout(r, 3000));
    //give permissions to the file
    doc.access_info.entities.push({
      type: "user",
      id: anotherUser.user.id,
      level: "read",
      grantor: null,
    });
    await oneUser.updateDocument(doc.id, doc);

    await new Promise(resolve => setTimeout(resolve, 5000));

    //when:: user search for a doc
    const searchResponse = await anotherUser.searchDocument({ view: "shared_with_me" });

    //then::
    expect(searchResponse.entities?.length).toEqual(1);
    const actual = searchResponse.entities[0];

    //file name
    expect(actual.name).toEqual(doc.name);
    //file type
    expect(actual.extension).toEqual(doc.extension);
    expect(actual.id).toEqual(doc.id);
    expect(actual.is_directory).toEqual(doc.is_directory);
    expect(actual.last_modified).toEqual(doc.last_modified);
    expect(actual.added).toEqual(doc.added);
    expect(actual.parent_id).toEqual(doc.parent_id);
    expect(actual.created_by?.id).toEqual(oneUser.user.id);
    expect(actual.created_by?.first_name).toEqual(oneUser.user.first_name);
    expect(actual.shared_by?.id).toEqual(oneUser.user.id);
    expect(actual.shared_by?.first_name).toEqual(oneUser.user.first_name);
  });

  it("'shared_with_me' shouldn't return files uploaded by me", async () => {
    jest.setTimeout(20000);
    //given:: user uploaded one doc and give permission to another user
    const oneUser = await TestHelpers.getInstance(platform, true);
    const anotherUser = await TestHelpers.getInstance(platform, true);
    const doc = await oneUser.uploadRandomFileAndCreateDocument();
    await new Promise(r => setTimeout(r, 3000));
    //give permissions to the file
    doc.access_info.entities.push({
      type: "user",
      id: anotherUser.user.id,
      level: "read",
      grantor: null,
    });
    await oneUser.updateDocument(doc.id, doc);
    //another user also uploaded several files
    await anotherUser.uploadRandomFileAndCreateDocument();

    await new Promise(resolve => setTimeout(resolve, 5000));

    //when:: user search for a doc
    const searchResponse = await anotherUser.sharedWithMeDocuments({});

    //then::
    expect(searchResponse.entities?.length).toEqual(1);
  })

  it("did search for an item that doesn't exist", async () => {
    await createItem();

    const unexistingSeachPayload = {
      search: "somethingthatdoesn'tandshouldn'texist",
    };
    const failSearchResponse = await e2e_searchDocument(platform, unexistingSeachPayload);
    const failSearchResult = deserialize<SearchResultMockClass>(
      SearchResultMockClass,
      failSearchResponse.body,
    );

    expect(failSearchResult.entities).toHaveLength(0);
  });

  it("did create a version for a drive item", async () => {
    const item = await createItem();
    const fileUploadResponse = await e2e_createDocumentFile(platform);
    const fileUploadResult = deserialize<ResourceUpdateResponse<File>>(
      ResourceUpdateResponse,
      fileUploadResponse.body,
    );

    const file_metadata = { external_id: fileUploadResult.resource.id };

    await e2e_createVersion(platform, item.id, { filename: "file2", file_metadata });
    await e2e_createVersion(platform, item.id, { filename: "file3", file_metadata });
    await e2e_createVersion(platform, item.id, { filename: "file4", file_metadata });

    const fetchItemResponse = await e2e_getDocument(platform, item.id);
    const fetchItemResult = deserialize<DriveItemDetailsMockClass>(
      DriveItemDetailsMockClass,
      fetchItemResponse.body,
    );

    expect(fetchItemResult.versions).toHaveLength(4);
  });

  it("did search by mime type", async () => {
    jest.setTimeout(10000);
    // given:: all the sample files uploaded and documents for them created
    await currentUser.uploadAllFilesOneByOne();

    const filters = {
      mime_type: "application/pdf",
    };

    await new Promise(r => setTimeout(r, 5000));

    let documents = await currentUser.searchDocument(filters);
    expect(documents.entities).toHaveLength(1);

    const actualFile = documents.entities[0];
    expect(actualFile.name).toEqual("sample.pdf");
  });

  it("did search by last modified", async () => {
    jest.setTimeout(10000);
    const user = await TestHelpers.getInstance(platform, true);
    // given:: all the sample files uploaded and documents for them created
    const start = new Date().getTime();
    await user.uploadAllFilesOneByOne();
    const end = new Date().getTime();
    await user.uploadAllFilesOneByOne();
    //wait for putting docs to elastic and its indexing
    await new Promise(r => setTimeout(r, 5000));

    //then:: all the files are searchable without filters
    let documents = await user.searchDocument({});
    expect(documents.entities).toHaveLength(TestHelpers.ALL_FILES.length * 2);

    //then:: only file uploaded in the [start, end] interval are shown in the search results
    const filters = {
      last_modified_gt: start.toString(),
      last_modified_lt: end.toString(),
    };
    documents = await user.searchDocument(filters);
    expect(documents.entities).toHaveLength(TestHelpers.ALL_FILES.length);
  });

  it("did search a file shared by another user", async () => {
    //given:
    const oneUser = await TestHelpers.getInstance(platform, true);
    const anotherUser = await TestHelpers.getInstance(platform, true);
    //upload files
    let files = await oneUser.uploadAllFilesOneByOne();

    await new Promise(r => setTimeout(r, 5000));

    //then:: files are not searchable for user without permissions
    expect((await anotherUser.sharedWithMeDocuments({})).entities).toHaveLength(0);

    //and searchable for user that have
    expect((await oneUser.searchDocument({})).entities).toHaveLength(TestHelpers.ALL_FILES.length);

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
    expect((await anotherUser.sharedWithMeDocuments({})).entities).toHaveLength(1);
  }, 30000000);

  it("did search a file by file owner", async () => {
    jest.setTimeout(30000);
    //given:
    const oneUser = await TestHelpers.getInstance(platform, true);
    const anotherUser = await TestHelpers.getInstance(platform, true);
    //upload files
    let files = await oneUser.uploadAllFilesOneByOne();
    await anotherUser.uploadAllFilesOneByOne();
    //give permissions for all files to 'another user'
    await Promise.all(
      files.map(f => {
        f.access_info.entities.push({
          type: "user",
          id: anotherUser.user.id,
          level: "read",
          grantor: null,
        });
        return oneUser.updateDocument(f.id, f);
      }),
    );

    await new Promise(r => setTimeout(r, 5000));

    //then:: all files are searchable for 'another user'
    expect((await anotherUser.searchDocument({})).entities).toHaveLength(
      TestHelpers.ALL_FILES.length * 2,
    );

    //and searchable for user that have
    expect(
      (
        await oneUser.searchDocument({
          creator: oneUser.user.id,
        })
      ).entities,
    ).toHaveLength(TestHelpers.ALL_FILES.length);
  });

  it("did search by 'added' date", async () => {
    jest.setTimeout(10000);
    const user = await TestHelpers.getInstance(platform, true);
    // given:: all the sample files uploaded and documents for them created
    await user.uploadRandomFileAndCreateDocument();
    const start = new Date().getTime();
    await user.uploadAllFilesAndCreateDocuments();
    const end = new Date().getTime();
    await user.uploadRandomFileAndCreateDocument();
    //wait for putting docs to elastic and its indexing
    await new Promise(r => setTimeout(r, 3000));

    //then:: all the files are searchable without filters
    let documents = await user.searchDocument({});
    expect(documents.entities).toHaveLength(TestHelpers.ALL_FILES.length + 2);

    //then:: only file uploaded in the [start, end] interval are shown in the search results
    const filters = {
      added_gt: start.toString(),
      added_lt: end.toString(),
    };
    documents = await user.searchDocument(filters);
    expect(documents.entities).toHaveLength(TestHelpers.ALL_FILES.length);
  });

  it("did search order by name", async () => {
    const user = await TestHelpers.getInstance(platform, true);
    // given:: all the sample files uploaded and documents for them created
    await user.uploadAllFilesAndCreateDocuments();
    //wait for putting docs to elastic and its indexing
    await new Promise(r => setTimeout(r, 5000));

    //when:: sort files by name is ascending order
    const options = {
      sort: {
        name_keyword: "asc",
      },
    };
    const documents = await user.searchDocument(options);

    //then all the files are sorted properly by name
    expect(documents.entities.map(e => e.name)).toEqual(TestHelpers.ALL_FILES.sort());
  }, 30000);

  it("did search order by name desc", async () => {
    jest.setTimeout(10000);
    const user = await TestHelpers.getInstance(platform, true);
    // given:: all the sample files uploaded and documents for them created
    await user.uploadAllFilesOneByOne();
    //wait for putting docs to elastic and its indexing
    await new Promise(r => setTimeout(r, 5000));

    //when:: sort files by name is ascending order
    const options = {
      sort: {
        name_keyword: "desc",
      },
    };
    const documents = await user.searchDocument(options);

    //then all the files are sorted properly by name
    expect(documents.entities.map(e => e.name)).toEqual(TestHelpers.ALL_FILES.sort().reverse());
  });

  it("did search order by added date", async () => {
    jest.setTimeout(10000);
    const user = await TestHelpers.getInstance(platform, true);
    // given:: all the sample files uploaded and documents for them created
    await user.uploadAllFilesOneByOne();
    //wait for putting docs to elastic and its indexing
    await new Promise(r => setTimeout(r, 5000));

    //when:: ask to sort files by the 'added' field
    const options = {
      sort: {
        added: "asc",
      },
    };
    const documents = await user.searchDocument(options);

    //then:: files should be sorted properly
    expect(documents.entities.map(e => e.name)).toEqual(TestHelpers.ALL_FILES);
  });

  it("did search order by added date desc", async () => {
    jest.setTimeout(10000);
    const user = await TestHelpers.getInstance(platform, true);
    // given:: all the sample files uploaded and documents for them created
    await user.uploadAllFilesOneByOne();
    //wait for putting docs to elastic and its indexing
    await new Promise(r => setTimeout(r, 5000));

    //when:: ask to sort files by the 'added' field desc
    const options = {
      sort: {
        added: "desc",
      },
    };
    const documents = await user.searchDocument(options);

    //then:: files should be sorted properly
    expect(documents.entities.map(e => e.name)).toEqual(TestHelpers.ALL_FILES.reverse());
  });
});
