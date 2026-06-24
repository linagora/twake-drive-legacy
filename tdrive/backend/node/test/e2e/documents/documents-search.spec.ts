import { describe, it, expect, afterAll } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import UserApi from "../common/user-api";
import { DriveFileMockClass } from "../common/entities/mock_entities";
import { DriveFile } from "../../../src/services/documents/entities/drive-file";

describe("the Drive Search feature", () => {
  let platform: TestPlatform;
  let userOne: UserApi;
  let start: number;
  let end: number;
  let userTwo: UserApi;
  const uploadedByUserOne = [];
  const uploadedByUserTwo = [];

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
        "statistics",
        "platform-services",
        "documents",
      ],
    });
  });

  afterAll(async () => {
    await platform?.tearDown();
    platform = null;
  });


  // Create data for all test at once, due not to have a lot of setTimeouts,
  // And test basic searches at once
  //TODO[ASH] refactor this after refactoring events handling in enittymanager
  it("Crete test data", async () => {
    //create one document for default user
    // await currentUser.createDefaultDocument(); // 1
    // await currentUser.uploadAllFilesOneByOne(); // 6

    userOne = await UserApi.getInstance(platform, true, {companyRole: "admin"});
    userTwo = await UserApi.getInstance(platform, true, {companyRole: "admin"});

    //user one upload 6 file to the personal folder
    uploadedByUserOne.push(...(await userOne.uploadAllFilesOneByOne("user_" + userOne.user.id)));
    start = new Date().getTime();
    //user on uploaded 6 files to the root folder
    uploadedByUserOne.push(...(await userOne.uploadAllFilesOneByOne("root")));
    end = new Date().getTime();
    //another user uploaded 6 files to the personal folder
    uploadedByUserTwo.push(...(await userTwo.uploadAllFilesOneByOne("user_" + userTwo.user.id)));
    //another user uploaded 6 files to the root folder
    uploadedByUserTwo.push(...(await userTwo.uploadAllFilesOneByOne("root")));
    await new Promise(resolve => setTimeout(resolve, 3000));

    //user one give permissions to user two to one of the documents from personal folder
    const doc = uploadedByUserOne[0]
    doc.access_info.entities.push({
      type: "user",
      id: userTwo.user.id,
      level: "read",
      grantor: null,
    });
    await userOne.updateDocument(doc.id, doc);

    await new Promise(resolve => setTimeout(resolve, 10000));
  });

  it("did search for an item", async () => {
    const searchPayload = {
      search: "sample",
    };

    const searchResult = await userOne.searchDocument(searchPayload);
    expect(searchResult.entities.length).toBeGreaterThanOrEqual(6);
  });


  it("did search for an item and check that all the fields for 'shared_with_me' view", async () => {
    // jest.setTimeout(20000);
    //when:: user search for a doc
    const searchResponse = await userOne.searchDocument({ view: "shared_with_me" });

    //then::
    expect(searchResponse.entities?.length).toEqual(UserApi.ALL_FILES.length * 3);
    const docs = searchResponse.entities.filter(e => e.id === uploadedByUserOne[0].id)
    expect(docs.length).toEqual(1)
    expectSharedDoc( docs[0], uploadedByUserOne[0]);
  });

  it("'shared_with_me' shouldn't return files uploaded by me", async () => {
    //when:: user search for a doc
    const searchResponse = await userTwo.sharedWithMeDocuments({});

    //then::
    expect(searchResponse.children?.length).toEqual(1);
  })

  it("did search for an item that doesn't exist", async () => {
    const unexistingSeachPayload = {
      search: "somethingthatdoesn'tandshouldn'texist",
    };
    const failSearchResult = await userOne.searchDocument(unexistingSeachPayload);

    expect(failSearchResult.entities).toHaveLength(0);
  });


  it("did search by mime type", async () => {
    const filters = {
      mime_type: "application/pdf",
    };

    //when
    let documents = await userOne.searchDocument(filters);

    //then
    expect(documents.entities).toHaveLength(3);
    expect(documents.entities[0].name.includes("pdf")).toBeTruthy();
    expect(documents.entities[1].name.includes("pdf")).toBeTruthy();
    expect(documents.entities[2].name.includes("pdf")).toBeTruthy();
  });

  it("did search by last modified", async () => {
    //then:: only file uploaded in the [start, end] interval are shown in the search results
    const filters = {
      last_modified_gt: start.toString(),
      last_modified_lt: end.toString(),
    };
    const documents = await userOne.searchDocument(filters);
    expect(documents.entities).toHaveLength(UserApi.ALL_FILES.length);
  });

  it("did search a file shared by another user", async () => {
    //then file become searchable
    expect((await userTwo.sharedWithMeDocuments({})).children).toHaveLength(1);
  });

  it("did search a file by file owner", async () => {
    //and searchable for user that have
    expect(
      (
        await userTwo.searchDocument({
          creator: userOne.user.id,
        })
      ).entities,
    ).toHaveLength(7);
  });

  it("did search by 'added' date", async () => {
    //then:: only file uploaded in the [start, end] interval are shown in the search results
    const filters = {
      added_gt: start.toString(),
      added_lt: end.toString(),
    };
    const documents = await userOne.searchDocument(filters);
    expect(documents.entities).toHaveLength(UserApi.ALL_FILES.length);
  });

  it("did search order by name", async () => {
    //when:: sort files by name is ascending order
    const options = {
      sort: {
        name_keyword: "asc",
      },
    };
    const documents = await userOne.searchDocument(options);

    //then all the files are sorted properly by name
    let actualNames = documents.entities.map(e => e.name);
    expect(actualNames).toEqual(actualNames.slice().sort());
  });

  it("did search order by name desc", async () => {
    //when:: sort files by name is ascending order
    const options = {
      sort: {
        name_keyword: "desc",
      },
    };
    const documents = await userOne.searchDocument(options);

    //then all the files are sorted properly by name
    let actualNames = documents.entities.map(e => e.name);
    expect(actualNames).toEqual(actualNames.slice().sort().reverse());
  });

  it("did search order by added date", async () => {
    //when:: ask to sort files by the 'added' field
    const options = {
      sort: {
        added: "asc",
      },
    };
    const documents = await userOne.searchDocument(options);

    //then:: files should be sorted properly
    let actualDocs = documents.entities;
    let expectedDocs = actualDocs.slice()
      .sort((a, b) => a.added - b.added)
      .map(d => d.name);
    expect(actualDocs.map(d => d.name)).toEqual(expectedDocs);
  });

  it("did search order by added date desc", async () => {
    //when:: ask to sort files by the 'added' field desc
    const options = {
      sort: {
        added: "desc",
      },
    };
    const documents = await userOne.searchDocument(options);

    //then:: files should be sorted properly
    let actualDocs = documents.entities;
    let expectedDocs = actualDocs.slice()
      .sort((a, b) => a.added - b.added)
      .map(d => d.name)
      .reverse();
    expect(actualDocs.map(d => d.name)).toEqual(expectedDocs);
  });

  function expectSharedDoc(actual: DriveFileMockClass, doc: DriveFile) {
    expect(actual.name).toEqual(doc.name);
    //file type
    expect(actual.extension).toEqual(doc.extension);
    expect(actual.id).toEqual(doc.id);
    expect(actual.is_directory).toEqual(doc.is_directory);
    expect(actual.last_modified).toEqual(doc.last_modified);
    expect(actual.added).toEqual(doc.added);
    expect(actual.parent_id).toEqual(doc.parent_id);
    expect(actual.created_by?.id).toEqual(userOne.user.id);
    expect(actual.created_by?.first_name).toEqual(userOne.user.first_name);
    expect(actual.shared_by?.id).toEqual(userOne.user.id);
    expect(actual.shared_by?.first_name).toEqual(userOne.user.first_name);
  }
});
