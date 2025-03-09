import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import UserApi from "../common/user-api";
import { DriveFile, TYPE as DriveFileType } from "../../../src/services/documents/entities/drive-file";
import { File } from "../../../src/services/files/entities/file";
import { FileVersion, TYPE as FileVersionType } from "../../../src/services/documents/entities/file-version";
import type User from "../../../src/services/user/entities/user";
import { getFilePath } from "../../../src/services/files/services";
import { buildUserDeletionRepositories } from "../../../src/core/platform/services/admin/utils";
import { getConfig } from "../../../src/core/platform/framework/api/admin";

const loadRepositories = async (platform: TestPlatform) => buildUserDeletionRepositories(platform!.database, platform!.search);

describe("The users deletion API", () => {
  let platform: TestPlatform | undefined;
  let adminUser: UserApi;
  let currentUser: UserApi;
  let userToTestPending: UserApi;
  let myUserId: string;
  let myDriveId: string;
  let myCompanyId: string;
  let repos: Awaited<ReturnType<typeof loadRepositories>>;
  const adminConfig = getConfig();


  const listByUserIn = {
      driveFileByCreator: async (userId: string) => repos.driveFile.find({ creator: userId }),
      driveFileByParent: async (userId: string) => repos.driveFile.find({ parent_id: "user_" + userId }),
      fileVersion: async (userId: string) => repos.fileVersion.find({ creator_id: userId }),
      file: async (userId: string) => repos.file.find({ user_id: userId }),
      missedDriveFile: async (userId: string) => repos.missedDriveFile.find({ creator: userId }),
      // user: async (userId: string) => repos.user.find({ id: userId }), // ignored because it stays with deleted=true
      companyUser: async (userId: string) => repos.companyUser.find({ user_id: userId }),
      externalUser: async (userId: string) => repos.externalUser.find({ user_id: userId }),
  };

  interface UserTreeEntry {
    driveFile: DriveFile;
    driveFileFromSearch?: DriveFile;
    versions?: {
      version: FileVersion,
      file?: File,
      storagePaths?: string[],
    }[];
    children?: UserTreeEntry[];
  }
  
  async function hydrateDriveFile(context: UserTreeEntry) {
    const { driveFile } = context;
    context.driveFileFromSearch = (await repos.search.driveFile.search({}, { $text: { $search: "d" } })).getEntities()[0];
    const versions = (await repos.fileVersion.find({ drive_item_id: driveFile.id })).getEntities();

    context.versions = await Promise.all(versions.map(async version => {
      const file = await repos.file.findOne({id: version.file_metadata.external_id});
      const fileStoragePath = file && getFilePath(file);
      return {
        version, file,
        storagePaths: fileStoragePath ? (await platform!.storage.getConnector().enumeratePathsForFile(fileStoragePath)) : undefined,
      };
    }));
  }
  
  async function loadDriveFiles(parent_id: string, parents: UserTreeEntry[] = []): Promise<UserTreeEntry[]> {
    const driveFiles = (await repos.driveFile.find({ parent_id })).getEntities();
    const tree = driveFiles.map(driveFile => ({ driveFile }) as UserTreeEntry);
    for (const entry of tree) {
      const { driveFile } = entry;
      if (driveFile.is_directory)
        entry.children = await loadDriveFiles(driveFile.id, parents.concat([entry]));
      else
        await hydrateDriveFile(entry);
    }
    return tree;
  }

  async function userTreeDescend(tree: UserTreeEntry[], map: (entry: UserTreeEntry, parents: UserTreeEntry[]) => Promise<void>, parents: UserTreeEntry[] = [], output: string[] = []) {
    for (const entry of tree) {
      await map(entry, parents);
      if (entry.children)
        await userTreeDescend(entry.children, map, parents.concat([entry]), output);
    }
  }

  async function userTreeToString(tree: UserTreeEntry[]) {
    const oneIndent = "    ";
    const output: string[] = [];
    await userTreeDescend(tree, async (entry, parents) => {
      const indent = parents.map(() => oneIndent).join("");
      output.push(indent + (entry.driveFile.is_directory ? "📂" : "📄") + " " + entry.driveFile.name);
      output.push(indent + oneIndent + " search: " + entry.driveFileFromSearch);
      for (const version of entry.versions ?? []) {
        output.push(indent + oneIndent + "version: " + JSON.stringify(version.version?.id));
        output.push(indent + oneIndent + "   file: " + JSON.stringify(version.file?.id));
        for (const path of version.storagePaths ?? [])
          output.push(indent + oneIndent + "   path: " + JSON.stringify(path));
      }
    });
    return output.join("\n");
  }

  async function createFakeFiles() {
    const rootFolder = await currentUser.createDirectory(myDriveId, { name: "root_folder" });
    const subRootFolder = await currentUser.createDirectory(rootFolder.id, { name: "sub_root_folder" });
    return {
      rootFolder,
      subRootFolder,
      fileAtRoot: await currentUser.uploadRandomFileAndCreateDocument(myDriveId),
      fileInRootFolder: await currentUser.uploadRandomFileAndCreateDocument(rootFolder.id),
      fileInSubRoot: await currentUser.uploadRandomFileAndCreateDocument(subRootFolder.id),
    };
  }

  function findEntriesInUserTree(tree: UserTreeEntry[]): { [EntryKey in keyof Awaited<ReturnType<typeof createFakeFiles>>]: UserTreeEntry | undefined } {
    const rootFolder = tree.find(({driveFile}) => driveFile.is_directory);
    const subRootFolder = rootFolder?.children!.find(({driveFile}) => driveFile.is_directory);
    return {
      rootFolder,
      subRootFolder,
      fileAtRoot: tree.find(({driveFile}) => !driveFile.is_directory),
      fileInRootFolder: rootFolder?.children?.find(({driveFile}) => !driveFile.is_directory),
      fileInSubRoot: subRootFolder?.children?.find(({driveFile}) => !driveFile.is_directory),
    }
  }

  async function getSearchEntriesFromFoundEntries(items: ReturnType<typeof findEntriesInUserTree>) {
    const searchDoc = async ({id}) => (await repos.search.driveFile.search({ id }, { pagination: {limitStr: "100"} })).getEntities()[0];
    return {
      fileAtRoot: await searchDoc(items.fileAtRoot!.driveFile),
      fileInRootFolder: await searchDoc(items.fileInRootFolder!.driveFile),
      fileInSubRoot: await searchDoc(items.fileInSubRoot!.driveFile),
    }
  }

  beforeAll(async () => {
    platform = await init({
      services: [
        "admin",
        "database",
        "search",
        "message-queue",
        "applications",
        "webserver",
        "user",
        "auth",
        "storage",
        "counter",
        "console",
        "workspaces",
        "statistics",
        "platform-services",
      ],
    });

    adminUser = await UserApi.getInstance(platform, true, { companyRole: "admin" });
    currentUser = await UserApi.getInstance(platform);
    userToTestPending = await UserApi.getInstance(platform, true);
    myUserId = currentUser.user.id;
    myDriveId = "user_" + currentUser.user.id;
    myCompanyId = currentUser.workspace.company_id;
    repos = await loadRepositories(platform);
  });

  afterAll(async () => {
    platform && await platform.tearDown();
    platform = undefined;
  });

  async function sendDeleteUser(secret: string, userId: string, expected: number = 200, deleteData: boolean = true) {
    const response = await platform!.app.inject({
      method: "POST",
      url: `/admin/api/user/delete`,
      body: { secret, userId, deleteData },
    });
    expect(response.statusCode).toBe(expected);
    if (expected === 200) return JSON.parse(response.body);
    return response;
  }

  async function requestPendingUserDeletions(secret: string, expected: number = 200) {
    const response = await platform!.app.inject({
      method: "POST",
      url: `/admin/api/user/delete/pending`,
      body: { secret },
    });
    expect(response.statusCode).toBe(expected);
    if (expected === 200) return JSON.parse(response.body);
    return response;
  }

  describe("admin/api/user/delete routes", () => {
    it("should have a secret setup or none of this test will work and we should know", () => {
      expect(adminConfig.endpointSecret).toBeTruthy();
    });

    it("should start with a non deleted user with some files", async () => {
      const user = await currentUser.getUser();
      expect(user).toMatchObject({
        id: myUserId,
        deleted: false,
        delete_process_started_epoch: 0,
      });

      const initialFakeFiles = await createFakeFiles();
      expect(initialFakeFiles.rootFolder.id).toBeTruthy();
      expect(initialFakeFiles.subRootFolder.id).toBeTruthy();
      expect(initialFakeFiles.fileAtRoot.id).toBeTruthy();
      expect(initialFakeFiles.fileInRootFolder.id).toBeTruthy();
      expect(initialFakeFiles.fileInSubRoot.id).toBeTruthy();

      // Wait for indexing, inspired by ../documents/documents-search.spec.ts
      await new Promise(resolve => setTimeout(resolve, 5000));

      const tree = await loadDriveFiles(myDriveId);
      const foundEntries = findEntriesInUserTree(tree);
      expect(foundEntries.rootFolder?.driveFile).toMatchObject({ id: initialFakeFiles.rootFolder.id, parent_id: myDriveId, name: "root_folder" });
      expect(foundEntries.subRootFolder?.driveFile).toMatchObject({ id: initialFakeFiles.subRootFolder.id, parent_id: initialFakeFiles.rootFolder.id, name: "sub_root_folder" });
      expect(foundEntries.fileAtRoot?.driveFile).toMatchObject({ id: initialFakeFiles.fileAtRoot.id });
      expect(foundEntries.fileInRootFolder?.driveFile).toMatchObject({ id: initialFakeFiles.fileInRootFolder.id });
      expect(foundEntries.fileInSubRoot?.driveFile).toMatchObject({ id: initialFakeFiles.fileInSubRoot.id });

      const searchDocs = await getSearchEntriesFromFoundEntries(foundEntries);
      expect(searchDocs.fileAtRoot).toMatchObject({ id: initialFakeFiles.fileAtRoot.id });
      expect(searchDocs.fileInRootFolder).toMatchObject({ id: initialFakeFiles.fileInRootFolder.id });
      expect(searchDocs.fileInSubRoot).toMatchObject({ id: initialFakeFiles.fileInSubRoot.id });
    });

    it("should reject queries without valid secret", async () => {
      await sendDeleteUser(adminConfig.endpointSecret + "x", myUserId, 403);
      await requestPendingUserDeletions(adminConfig.endpointSecret + "x", 403);
    });
   
    it("should reject queries without valid user ID", async () => {
      await sendDeleteUser(adminConfig.endpointSecret!, "", 400);
    });

    it("should start with an empty pending list", async () => {
      const responseBody = await requestPendingUserDeletions(adminConfig.endpointSecret!, 200);
      expect(responseBody).toStrictEqual([]);
    });

    it("should timeout with temp test user ID", async () => {
      let isResolved = false;
      const waitable = sendDeleteUser(adminConfig.endpointSecret!, "e2e_simulate_timeout", 400);
      waitable.then(() => isResolved = true, () => isResolved = true);
      expect(new Promise(resolve => setTimeout(() => resolve(isResolved), 3000))).resolves.toBeFalsy();
    });

    it("should be immediately listed after deletion", async () => {
      const deleteResult = await sendDeleteUser(adminConfig.endpointSecret!, userToTestPending.user.id, 200, false);
      expect(deleteResult).toMatchObject({ status: "deleting" });
      const pendingDeletes = await requestPendingUserDeletions(adminConfig.endpointSecret!, 200);
      expect(pendingDeletes).toHaveLength(1);
      expect(pendingDeletes[0]).toHaveLength(2);
      expect(pendingDeletes[0][0]).toBe(userToTestPending.user.id);
      expect(pendingDeletes[0][1]).toBeGreaterThan(0);
      const userBefore = await adminUser.getUser(userToTestPending.user.id);
      expect(userBefore).toMatchObject({
        id: userToTestPending.user.id,
        deleted: true,
      });
      expect((userBefore as unknown as User).delete_process_started_epoch).toBeGreaterThan(0);
      const actualDeleteResult = await sendDeleteUser(adminConfig.endpointSecret!, userToTestPending.user.id, 200, true);
      expect(actualDeleteResult).toMatchObject({ status: "done" });
      expect(await requestPendingUserDeletions(adminConfig.endpointSecret!, 200)).toStrictEqual([ ]);
      const userAfter = await adminUser.getUser(userToTestPending.user.id);
      expect(userAfter).toMatchObject({
        id: userToTestPending.user.id,
        deleted: true,
      });
      expect((userAfter as unknown as User).delete_process_started_epoch).toBe(0);
    });

    it("the user deletion should complete inline in e2e", async () => {
      const deleteResult = await sendDeleteUser(adminConfig.endpointSecret!, myUserId, 200, true);
      expect(deleteResult).toMatchObject({ status: "done" });
    });

    it("the user should no longer have any documents", async () => {
      const tree = await loadDriveFiles(myDriveId);
      const foundEntries = findEntriesInUserTree(tree);
      expect(foundEntries.rootFolder?.driveFile).toBeUndefined();
      expect(foundEntries.subRootFolder?.driveFile).toBeUndefined();
      expect(foundEntries.fileAtRoot?.driveFile).toBeUndefined();
      expect(foundEntries.fileInRootFolder?.driveFile).toBeUndefined();
      expect(foundEntries.fileInSubRoot?.driveFile).toBeUndefined();
    });

    it("the user should be marked deleted", async () => {
      const user = await adminUser.getUser(currentUser.user.id);
      expect(user).toMatchObject({
        id: myUserId,
        deleted: true,
      });
      expect((user as unknown as User).delete_process_started_epoch).toBe(0);
    });

    it("the user should not be able to continue with API", async () => {
      expect(await currentUser.browseDocuments(myDriveId)).toMatchObject({
        "error": "Unauthorized",
      });
    });

    it("should have no objects left other than user (and untestable files)", async () => {
      expect(await (await Promise.all(
        Object.entries(listByUserIn)
          .flatMap(async ([key, fn]) => (await fn(myUserId)).getEntities().map(e => ({"": e.constructor.name, ...e})))
        )).flat()).toHaveLength(0);
    });
  });
});
