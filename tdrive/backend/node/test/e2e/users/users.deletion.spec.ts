import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import UserApi from "../common/user-api";
import type { DriveExecutionContext } from "../../../src/services/documents/types";
import { DriveFile, TYPE as DriveFileType } from "../../../src/services/documents/entities/drive-file";
import { File } from "../../../src/services/files/entities/file";
import { FileVersion, TYPE as FileVersionType } from "../../../src/services/documents/entities/file-version";
import User, { TYPE as UserType } from "../../../src/services/user/entities/user";
import { getFilePath } from "../../../src/services/files/services";
import { buildUserDeletionRepositories } from "../../../src/core/platform/services/admin/controller/delete-user-controller";
import { getConfig } from "../../../src/core/platform/framework/api/admin";

const loadRepositories = async (platform: TestPlatform) => buildUserDeletionRepositories(platform.database, platform.search);

describe("The users deletion API", () => {
  const url = "/internal/services/users/v1";
  let platform: TestPlatform;
  let currentUser: UserApi;
  let myUserId: string;
  let myDriveId: string;
  let myCompanyId: string;
  let repos: Awaited<ReturnType<typeof loadRepositories>>;
  const adminConfig = getConfig();

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
    context.driveFileFromSearch = (await repos.search.driveFile.search({}, { $text: { $search: driveFile.name } }, { user: { id: myUserId }, company: { id: myCompanyId } } as DriveExecutionContext)).getEntities()[0];
    const versions = (await repos.fileVersion.find({ drive_item_id: driveFile.id })).getEntities();

    context.versions = await Promise.all(versions.map(async version => {
      const file = await repos.file.findOne({id: version.file_metadata.external_id});
      const fileStoragePath = file && getFilePath(file);
      return {
        version, file,
        storagePaths: fileStoragePath ? (await platform.storage.getConnector().enumeratePathsForFile(fileStoragePath)) : undefined,
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

    currentUser = await UserApi.getInstance(platform);
    myUserId = currentUser.user.id;
    myDriveId = "user_" + currentUser.user.id;
    myCompanyId = currentUser.workspace.company_id;
    repos = await loadRepositories(platform);
  });

  afterAll(async () => {
    await platform.tearDown();
    platform = null;
  });

  async function sendDeleteUser(secret: string, userId: string, expected: number = 200) {
    const response = await platform.app.inject({
      method: "POST",
      url: `/admin/user/delete`,
      body: { secret, userId },
    });
    expect(response.statusCode).toBe(expected);
    if (expected === 200) return JSON.parse(response.body);
    return response;
  }

  async function requestPendingUserDeletions(secret: string, expected: number = 200) {
    const response = await platform.app.inject({
      method: "POST",
      url: `/admin/user/delete/pending`,
      body: { secret },
    });
    expect(response.statusCode).toBe(expected);
    if (expected === 200) return JSON.parse(response.body);
    return response;
  }

  describe("The DELETE /users/:id route", () => {
    it("should have a secret setup or none of this test will work and we should know", () => {
      expect(adminConfig.endpointSecret).toBeTruthy();
    });

    //TODO: NONONONO
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

      // const docs = await currentUser.browseDocuments(myDriveId, {});
      // console.error(JSON.stringify(docs, null, 2)); // works, but projected values
      // const docs = await platform.documentService.browse(myDriveId, { }, { user: { id: myUserId }, company: { id: "string" } } as DriveExecutionContext);
      // console.error(JSON.stringifya(docs, null, 2)); // doesn't work, empty children

      // Wait for indexing, inspired by tdrive/backend/node/test/e2e/documents/documents-search.spec.ts
      await new Promise(resolve => setTimeout(resolve, 5000)); // TODO: search doesn't work anyway

      const tree = await loadDriveFiles(myDriveId);
      console.log((await userTreeToString(tree)));

      console.log((await repos.search.driveFile.search({}, { $text: { $search: "" } }, undefined)).getEntities());
      console.log((await repos.search.user.search({}, { $text: { $search: "" } }, undefined)).getEntities());

      const foundEntries = findEntriesInUserTree(tree);
      expect(foundEntries.rootFolder?.driveFile).toMatchObject({ id: initialFakeFiles.rootFolder.id, parent_id: myDriveId, name: "root_folder" });
      expect(foundEntries.subRootFolder?.driveFile).toMatchObject({ id: initialFakeFiles.subRootFolder.id, parent_id: initialFakeFiles.rootFolder.id, name: "sub_root_folder" });
      expect(foundEntries.fileAtRoot?.driveFile).toMatchObject({ id: initialFakeFiles.fileAtRoot.id });
      expect(foundEntries.fileInRootFolder?.driveFile).toMatchObject({ id: initialFakeFiles.fileInRootFolder.id });
      expect(foundEntries.fileInSubRoot?.driveFile).toMatchObject({ id: initialFakeFiles.fileInSubRoot.id });
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

    it("should be immediately listed after deletion", async () => {
      await sendDeleteUser(adminConfig.endpointSecret!, myUserId, 200);
      // TODO: wait for message queue stuff ?
      const responseBody = await requestPendingUserDeletions(adminConfig.endpointSecret!, 200);
      expect(responseBody).toStrictEqual([myUserId]);
    });

    it("the user should be marked at least as pending deletion", async () => {
      const user = await currentUser.getUser();
      expect(user).toMatchObject({
        id: myUserId,
        deleted: true,
      });
      expect((user as unknown as User).delete_process_started_epoch).toBeGreaterThan(0);
    });

    it("the user should not be able to login", async () => {
      expect((await currentUser.login()).statusCode).toBe(401);
    });

  });
});
