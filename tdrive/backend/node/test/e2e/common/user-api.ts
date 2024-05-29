// @ts-ignore
import fs from "fs";
import { Readable } from "stream";
import { ResourceUpdateResponse, Workspace } from "../../../src/utils/types";
import { File } from "../../../src/services/files/entities/file";
import { deserialize } from "class-transformer";
import formAutoContent from "form-auto-content";
import { TestPlatform, User } from "../setup";
import { v1 as uuidv1 } from "uuid";
import { TestDbService } from "../utils.prepare.db";
import { DriveFile } from "../../../src/services/documents/entities/drive-file";
import { FileVersion } from "../../../src/services/documents/entities/file-version";
import {
  AccessTokenMockClass,
  DriveItemDetailsMockClass,
  SearchResultMockClass,
  UserQuotaMockClass
} from "./entities/mock_entities";
import { logger } from "../../../src/core/platform/framework";
import { expect } from "@jest/globals";
import { DriveFileAccessLevel, publicAccessLevel } from "../../../src/services/documents/types";
import { UserQuota } from "../../../src/services/user/web/types";
import { Api } from "../utils.api";
import { OidcJwtVerifier } from "../../../src/services/console/clients/remote-jwks-verifier";

/** The UserApi is an abstraction for E2E tests that
 * represents the high level actions a user can take
 * in the application.
 */
export default class UserApi {

  private static readonly DOC_URL = "/internal/services/documents/v1";

  static readonly ALL_FILES = [
    "sample.png",
    "sample.gif",
    "sample.pdf",
    "sample.doc",
    "sample.zip",
    "sample.mp4"
  ];

  platform: TestPlatform;
  dbService: TestDbService;

  user: User;
  anonymous: User;
  workspace: Workspace;
  jwt: string;
  api: Api;
  session: string;

  private constructor(
    platform: TestPlatform
  ) {
    this.platform = platform;
  }

  private async init(newUser: boolean, options?: {}) {
    this.dbService = await TestDbService.getInstance(this.platform, true);
    this.workspace = this.platform.workspace;
    if (newUser) {
      const workspacePK = {
        id: this.workspace.workspace_id,
        company_id: this.workspace.company_id,
      };
      this.user = await this.dbService.createUser([workspacePK], options, uuidv1());
      this.anonymous = await this.dbService.createUser([workspacePK],
        {
          ...options,
          identity_provider: "anonymous",
        },
        uuidv1());
    } else {
      this.user = this.platform.currentUser;
    }
    this.api = new Api(this.platform, this.user);
    this.jwt = await this.doLogin();
  }

  public async doLogin() {
    const loginResponse = await this.login();

    expect(loginResponse).toBeDefined();
    expect(loginResponse.statusCode).toEqual(200);

    const accessToken = deserialize<AccessTokenMockClass>(AccessTokenMockClass, loginResponse.body);
    if (!accessToken.access_token?.value)
      throw Error("Auth error: authentication token doesn't exists in response");
    return accessToken.access_token.value;
  }

  /**
   * Just send the login requests without any validation and login response assertion
   */
  public async login(session?: string) {
    if (session !== undefined) {
      this.session = session;
    } else {
      this.session = uuidv1();
    }
    const payload = {
      claims: {
        sub: this.user.id,
        first_name: this.user.first_name,
        sid: this.session,
      },
    };
    const verifierMock = jest.spyOn(OidcJwtVerifier.prototype, "verifyIdToken");
    verifierMock.mockImplementation(() => {
      return Promise.resolve(payload); // Return the predefined payload
    });
    return await this.api.post("/internal/services/console/v1/login", {
      oidc_id_token: "sample_oidc_token",
    });
  }

  public async logout() {
    const payload = {
      claims: {
        iss: "tdrive_lemonldap",
        sub: this.user.id,
        sid: this.session,
        aud: "your-audience",
        iat: Math.floor(Date.now() / 1000),
        jti: "jwt-id",
        events: {
          "http://schemas.openid.net/event/backchannel-logout": {},
        },
      }
    };
    const verifierMock = jest.spyOn(OidcJwtVerifier.prototype, "verifyLogoutToken");
    verifierMock.mockImplementation(() => {
      return Promise.resolve(payload); // Return the predefined payload
    });

    return await this.api.post("/internal/services/console/v1/backchannel_logout", {
      logout_token: "logout_token_rsa256",
    });
  }


  public static async getInstance(platform: TestPlatform, newUser = false, options?: {}): Promise<UserApi> {
    const helpers = new UserApi(platform);
    await helpers.init(newUser, options);
    return helpers;
  }

  async uploadRandomFile() {
    return await this.uploadFile(UserApi.ALL_FILES[Math.floor((Math.random() * UserApi.ALL_FILES.length))]);
  }

  private async injectUploadRequest(readable: Readable | string) {
    if (typeof readable === "string")
      readable = Readable.from(readable);
    const url = "/internal/services/files/v1";
    const form = formAutoContent({ file: readable });
    form.headers["authorization"] = `Bearer ${this.jwt}`;

    return await this.platform.app.inject({
      method: "POST",
      url: `${url}/companies/${this.platform.workspace.company_id}/files?thumbnail_sync=0`,
      ...form
    });
  }

  async uploadFile(filename: string) {
    logger.info(`Upload ${filename} for the user: ${this.user.id}`);
    const fullPath = `${__dirname}/assets/${filename}`;
    const filesUploadRaw = await this.injectUploadRequest(fs.createReadStream(fullPath));

    if (filesUploadRaw.statusCode == 200) {
      const filesUpload: ResourceUpdateResponse<File> = deserialize<ResourceUpdateResponse<File>>(
        ResourceUpdateResponse,
        filesUploadRaw.body
      );
      return filesUpload.resource;
    } else this.throwServerError(filesUploadRaw.statusCode);
  }

  private throwServerError(code: number) {
    throw new Error("Error code: " + code)
  }

  public getJWTTokenForUser(userId: string): string {
    const payload = {
      sub: userId,
      role: ""
    };
    return this.platform.authService.sign(payload);
  }

  async uploadFileAndCreateDocument(
    filename: string,
    parent_id = "root"
  ) {
    return this.uploadFile(filename).then(f => this.createDocumentFromFile(f, parent_id));
  };

  async uploadRandomFileAndCreateDocument(parent_id = "root") {
    return this.uploadRandomFile().then(f => this.createDocumentFromFile(f, parent_id));
  };

  async uploadAllFilesAndCreateDocuments(parent_id = "root") {
    return await Promise.all(UserApi.ALL_FILES.map(f => this.uploadFileAndCreateDocument(f, parent_id)));
  };

  async uploadAllFilesOneByOne(parent_id = "root") {
    const files: Array<DriveFile> = [];
    for (const idx in UserApi.ALL_FILES) {
      const f = await this.uploadFile(UserApi.ALL_FILES[idx]);
      const doc = await this.createDocumentFromFile(f, parent_id);
      files.push(doc);
    }
    return files;
  };

  async createDirectory(parent = "root", overrides?: Partial<DriveFile>) {
    const directory = await this.createDocument({
      company_id: this.platform.workspace.company_id,
      name: "Test Folder Name",
      parent_id: parent,
      is_directory: true,
      ...overrides
    }, {});
    expect(directory).toBeDefined();
    expect(directory).not.toBeNull();
    expect(directory.id).toBeDefined();
    expect(directory.id).not.toBeNull();
    return directory;
  }

  /** Run the provided callback using the specified bearer JWT token */
  async impersonateWithJWT<T>(jwt: string, cb: () => Promise<T>): Promise<T> {
    const previous = this.jwt;
    this.jwt = jwt;
    let result: T | undefined = undefined;
    try {
      result = await cb();
    } finally {
      this.jwt = previous;
    }
    return result;
  }

  /** Gets the public link access token then `impersonateWithJWT` as an anonymous user with that link */
  async impersonatePublicLinkAccessOf<T>(item: Partial<DriveFile> & { id: string }, cb: () => Promise<T>): Promise<T> {
    const publicToken = await this.getPublicLinkAccessToken(item);
    expect(publicToken?.value?.length ?? "").toBeGreaterThan(0);
    return this.impersonateWithJWT(publicToken?.value, cb);
  }

  async createDocument(
    item: Partial<DriveFile>,
    version: Partial<FileVersion>
  ) {
    const response = await this.api.post(`${UserApi.DOC_URL}/companies/${this.platform.workspace.company_id}/item`,
      {
        item,
        version
      }, {
        authorization: `Bearer ${this.jwt}`
      });
    return deserialize<DriveFile>(DriveFile, response.body);
  };

  async createDefaultDocument(overrides?: Partial<DriveFile>): Promise<DriveFile> {
    const scope: "personal" | "shared" = "shared";
    const item = {
      name: "new test file",
      parent_id: "root",
      company_id: this.platform.workspace.company_id,
      scope,
      ...overrides,
    };

    return await this.createDocument(item, {});
  };

  async shareWithPublicLink(doc: Partial<DriveFile> & { id: string }, accessLevel: publicAccessLevel) {
    return await this.updateDocument(doc.id, {
      ...doc,
      access_info: {
        ...doc.access_info!,
        public: {
          ...doc.access_info?.public!,
          level: accessLevel
        }
      }
    });
  }

  async shareWithPublicLinkWithOkCheck(doc: Partial<DriveFile> & { id: string }, accessLevel: publicAccessLevel) {
    const shareResponse =  await this.shareWithPublicLink(doc, accessLevel);
    expect(shareResponse.statusCode).toBe(200);
    return deserialize<DriveFile>(DriveFile, shareResponse.body);
  }

  async shareWithPermissions(doc: Partial<DriveFile> & { id: string }, toUserId: string, permissions: DriveFileAccessLevel) {
    doc.access_info.entities.push({
      type: "user",
      id: toUserId,
      level: permissions,
      grantor: null,
    });
    console.log(`INFO:: ${doc.access_info}`);
    return await this.updateDocument(doc.id, doc);
  }

  async getPublicLinkAccessToken(doc: Partial<DriveFile>) {
    const accessRes = await this.platform.app.inject({
      method: "POST",
      url: `${UserApi.DOC_URL}/companies/${doc.company_id}/anonymous/token`,
      headers: {},
      payload: {
        company_id: doc.company_id,
        document_id: doc.id,
        token: doc.access_info.public?.token
      }
    });
    const { access_token } = deserialize<AccessTokenMockClass>(
      AccessTokenMockClass,
      accessRes.body
    );
    expect(access_token).toBeDefined();

    return access_token;
  }

  async createRandomDocument(
    parent_id = "root"
  ) {
    const file = await this.uploadRandomFile();

    const doc = await this.createDocumentFromFile(file, parent_id);

    expect(doc).toBeDefined();
    expect(doc).not.toBeNull();
    expect(doc.parent_id).toEqual(parent_id);

    return doc;
  };

  async createDocumentFromFilename(
    file_name:
      | "sample.png"
      | "sample.doc"
      | "sample.pdf"
      | "sample.zip"
      | "sample.mp4"
      | "sample.gif",
    parent_id = "root",
  ) {
    const file = await this.uploadFile(file_name);

    const doc = await this.createDocumentFromFile(file, parent_id);

    expect(doc).toBeDefined();
    expect(doc).not.toBeNull();
    expect(doc.parent_id).toEqual(parent_id);

    return doc;
  };

  async createDocumentFromFile(
    file: File,
    parent_id = "root"
  ) {
    const item = {
      name: file.metadata.name,
      parent_id: parent_id,
      company_id: file.company_id
    };

    const version = {
      file_metadata: {
        name: file.metadata.name,
        size: file.upload_data?.size,
        thumbnails: [],
        external_id: file.id
      }
    };

    return await this.createDocument(item, version);
  };

  async updateDocument(
    id: string | "root" | "trash" | "shared_with_me",
    item: Partial<DriveFile>
  ) {
    return await this.api.post(
      `${UserApi.DOC_URL}/companies/${this.platform.workspace.company_id}/item/${id}`,
      item,
      {
        authorization: `Bearer ${this.jwt}`
      });
  };

  async searchDocument(
    payload: Record<string, any>
  ) {
    const response = await this.platform.app.inject({
      method: "POST",
      url: `${UserApi.DOC_URL}/companies/${this.platform.workspace.company_id}/search`,
      headers: {
        authorization: `Bearer ${this.jwt}`
      },
      payload
    });

    return deserialize<SearchResultMockClass>(
      SearchResultMockClass,
      response.body);
  };

  async browseDocuments(
    id: string,
    payload: Record<string, any> = {}
  ) {
    const response = await this.platform.app.inject({
      method: "POST",
      url: `${UserApi.DOC_URL}/companies/${this.platform.workspace.company_id}/browse/${id}`,
      headers: {
        authorization: `Bearer ${this.jwt}`
      },
      payload
    });

    return deserialize<DriveItemDetailsMockClass>(
      DriveItemDetailsMockClass,
      response.body);
  };

  async getDocument(id: string | "root" | "trash" | "shared_with_me") {
    return await this.platform.app.inject({
      method: "GET",
      url: `${UserApi.DOC_URL}/companies/${this.platform.workspace.company_id}/item/${id}`,
      headers: {
        authorization: `Bearer ${this.jwt}`
      }
    });
  };

  async zipDocument(id: string | "root" | "trash" | "shared_with_me") {
    return await this.platform.app.inject({
      method: "GET",
      url: `${UserApi.DOC_URL}/companies/${this.platform.workspace.company_id}/item/download/zip?items=${id}`,
      headers: {
        authorization: `Bearer ${this.jwt}`
      }
    });
  };

  async getDocumentOKCheck(id: string | "root" | "trash" | "shared_with_me") {
    const response = await this.getDocument(id);
    expect(response.statusCode).toBe(200);
    const doc = deserialize<DriveItemDetailsMockClass>(DriveItemDetailsMockClass, response.body);
    expect(doc.item?.id).toBe(id);
    return doc;
  };

  async sharedWithMeDocuments(
    payload: Record<string, any>
  ) {
    const response = await this.platform.app.inject({
      method: "POST",
      url: `${UserApi.DOC_URL}/companies/${this.platform.workspace.company_id}/browse/shared_with_me`,
      headers: {
        authorization: `Bearer ${this.jwt}`
      },
      payload
    });

    return deserialize<DriveItemDetailsMockClass>(
      DriveItemDetailsMockClass,
      response.body);
  };

  async quota() {
    const url = "/internal/services/users/v1/users";

    const response = await this.platform.app.inject({
      method: "GET",
      headers: { "authorization": `Bearer ${this.jwt}` },
      url: `${url}/${this.user.id}/quota?companyId=${this.platform.workspace.company_id}`
    });

    return deserialize<UserQuota>(UserQuotaMockClass, response.body);
  }

  async delete(id: string) {
    return await this.platform.app.inject({
      method: "DELETE",
      url: `${UserApi.DOC_URL}/companies/${this.platform.workspace.company_id}/item/${id}`,
      headers: { "authorization": `Bearer ${this.jwt}` },
    });
  }
}

