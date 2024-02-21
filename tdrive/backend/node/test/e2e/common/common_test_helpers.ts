// @ts-ignore
import fs from "fs";
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
import { publicAccessLevel } from "../../../src/services/documents/types";
import { UserQuota } from "../../../src/services/user/web/types";

export default class TestHelpers {

    private static readonly DOC_URL = "/internal/services/documents/v1";

    static readonly ALL_FILES = [
        "sample.png",
        "sample.gif",
        "sample.pdf",
        "sample.doc",
        "sample.zip",
        "sample.mp4",
    ]

    platform: TestPlatform;
    dbService: TestDbService;
    user: User;
    anonymous: User;
    workspace: Workspace;
    jwt: string;

    private constructor(
        platform: TestPlatform,
    ) {
        this.platform = platform
    }

    private async init(newUser: boolean, options?: {}) {
        this.dbService = await TestDbService.getInstance(this.platform, true);
        if (newUser) {
            this.workspace = this.platform.workspace;
            const workspacePK = {id: this.workspace.workspace_id, company_id: this.workspace.company_id};
            this.user = await this.dbService.createUser([workspacePK], options, uuidv1());
            this.anonymous = await this.dbService.createUser([workspacePK],
              { ...options,
                  identity_provider: "anonymous",
                },
              uuidv1());
        } else {
            this.user = this.platform.currentUser;
            this.workspace = this.platform.workspace;
        }
        this.jwt = this.getJWTTokenForUser(this.user.id);
    }

    public static async getInstance(platform: TestPlatform, newUser = false, options?: {}): Promise<TestHelpers> {
        const helpers = new TestHelpers(platform);
        await helpers.init(newUser, options)
        return helpers;
    }

    async uploadRandomFile() {
        return await this.uploadFile(TestHelpers.ALL_FILES[Math.floor((Math.random()*TestHelpers.ALL_FILES.length))])
    }

    async uploadFile(filename: string) {
        logger.info(`Upload ${filename} for the user: ${this.user.id}`);
        const fullPath = `${__dirname}/assets/${filename}`
        const url = "/internal/services/files/v1";
        const form = formAutoContent({file: fs.createReadStream(fullPath)});
        form.headers["authorization"] = `Bearer ${this.jwt}`;

        const filesUploadRaw = await this.platform.app.inject({
            method: "POST",
            url: `${url}/companies/${this.platform.workspace.company_id}/files?thumbnail_sync=0`,
            ...form,
        });

        const filesUpload: ResourceUpdateResponse<File> = deserialize<ResourceUpdateResponse<File>>(
            ResourceUpdateResponse,
            filesUploadRaw.body,
        );
        return filesUpload.resource;
    }

    private getJWTTokenForUser(userId: string): string {
        const payload = {
            sub: userId,
            role: "",
        }
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
        return await Promise.all(TestHelpers.ALL_FILES.map(f => this.uploadFileAndCreateDocument(f, parent_id)))
    };

    async uploadAllFilesOneByOne(parent_id = "root") {
        const files: Array<DriveFile> = [];
        for (const idx in TestHelpers.ALL_FILES) {
            const f = await this.uploadFile(TestHelpers.ALL_FILES[idx]);
            const doc = await this.createDocumentFromFile(f, parent_id);
            files.push(doc);
        }
        return files;
    };

    async createDirectory(parent = "root") {
        const directory = await this.createDocument({
            company_id: this.platform.workspace.company_id,
            name: "Test Folder Name",
            parent_id: parent,
            is_directory: true,
        }, {});
        expect(directory).toBeDefined();
        expect(directory).not.toBeNull();
        expect(directory.id).toBeDefined()
        expect(directory.id).not.toBeNull();
        return directory;
    }

    private async createDocument(
        item: Partial<DriveFile>,
        version: Partial<FileVersion>
    ) {

        const response = await this.platform.app.inject({
            method: "POST",
            url: `${TestHelpers.DOC_URL}/companies/${this.platform.workspace.company_id}/item`,
            headers: {
                authorization: `Bearer ${this.jwt}`,
            },
            payload: {
                item,
                version,
            },
        });
        return deserialize<DriveFile>(DriveFile, response.body);
    };

    async shareWithPublicLink(doc: Partial<DriveFile>, accessLevel: publicAccessLevel) {
        return await this.updateDocument(doc.id, {
            ...doc,
            access_info: {
                ...doc.access_info,
                public: {
                    ...doc.access_info.public!,
                    level: accessLevel,
                }
            }
        });
    }

    async getPublicLinkAccessToken(doc: Partial<DriveFile>) {
        const accessRes = await this.platform.app.inject({
            method: "POST",
            url: `${TestHelpers.DOC_URL}/companies/${doc.company_id}/anonymous/token`,
            headers: {},
            payload: {
                company_id: doc.company_id,
                document_id: doc.id,
                token: doc.access_info.public?.token,
            },
        });
        const { access_token } = deserialize<AccessTokenMockClass>(
          AccessTokenMockClass,
          accessRes.body,
        );
        expect(access_token).toBeDefined();

        return access_token;
    }

    async createRandomDocument(
      parent_id = "root",
    ) {
        const file = await this.uploadRandomFile();

        const doc = await this.createDocumentFromFile(file, parent_id);

        expect(doc).toBeDefined();
        expect(doc).not.toBeNull();
        expect(doc.parent_id).toEqual(parent_id)

        return doc;
    };

    async createDocumentFromFilename(
      file_name: "sample.png",
      parent_id = "root",
    ) {
        const file = await this.uploadFile(file_name);

        const doc = await this.createDocumentFromFile(file, parent_id);

        expect(doc).toBeDefined();
        expect(doc).not.toBeNull();
        expect(doc.parent_id).toEqual(parent_id)

        return doc;
    };

    async createDocumentFromFile(
        file: File,
        parent_id = "root",
    ) {
        const item = {
            name: file.metadata.name,
            parent_id: parent_id,
            company_id: file.company_id,
        };

        const version = {
            file_metadata: {
                name: file.metadata.name,
                size: file.upload_data?.size,
                thumbnails: [],
                external_id: file.id
            }
        }

        return await this.createDocument(item, version);
    };

    async updateDocument(
        id: string | "root" | "trash" | "shared_with_me",
        item: Partial<DriveFile>
    ) {
        return await this.platform.app.inject({
            method: "POST",
            url: `${TestHelpers.DOC_URL}/companies/${this.platform.workspace.company_id}/item/${id}`,
            headers: {
                authorization: `Bearer ${this.jwt}`,
            },
            payload: item,
        });
    };

    async searchDocument (
        payload: Record<string, any>
    ){
        const response = await this.platform.app.inject({
            method: "POST",
            url: `${TestHelpers.DOC_URL}/companies/${this.platform.workspace.company_id}/search`,
            headers: {
                authorization: `Bearer ${this.jwt}`,
            },
            payload,
        });

        return deserialize<SearchResultMockClass>(
            SearchResultMockClass,
            response.body)
    };

    async browseDocuments (
      id: string,
      payload: Record<string, any>
    ){
        const response = await this.platform.app.inject({
            method: "POST",
            url: `${TestHelpers.DOC_URL}/companies/${this.platform.workspace.company_id}/browse/${id}`,
            headers: {
                authorization: `Bearer ${this.jwt}`,
            },
            payload,
        });

        return deserialize<DriveItemDetailsMockClass>(
          DriveItemDetailsMockClass,
          response.body)
    };

    async getDocument(id: string | "root" | "trash" | "shared_with_me") {
        return await this.platform.app.inject({
            method: "GET",
            url: `${TestHelpers.DOC_URL}/companies/${this.platform.workspace.company_id}/item/${id}`,
            headers: {
                authorization: `Bearer ${this.jwt}`,
            },
        });
    };

    async getFolder(id: string | "root" | "trash" | "shared_with_me") {
        return await this.platform.app.inject({
            method: "GET",
            url: `${TestHelpers.DOC_URL}/companies/${this.platform.workspace.company_id}/item/download/zip?items=${id}`,
            headers: {
                authorization: `Bearer ${this.jwt}`,
            },
        });
    };


    async getDocumentOKCheck(id: string | "root" | "trash" | "shared_with_me") {
        const response = await this.getDocument(id);
        expect(response.statusCode).toBe(200);
        const doc = deserialize<DriveItemDetailsMockClass>(DriveItemDetailsMockClass, response.body);
        expect(doc.item?.id).toBe(id);
    };

    async getFolderOKCheck(id: string | "root" | "trash" | "shared_with_me") {
        const response = await this.getFolder(id);
        expect(response.statusCode).toBe(200);
        const doc = deserialize<DriveItemDetailsMockClass>(DriveItemDetailsMockClass, response.body);
        expect(doc.item?.id).toBe(id);
    };

    async sharedWithMeDocuments (
      payload: Record<string, any>
    ){
        const response = await this.platform.app.inject({
            method: "POST",
            url: `${TestHelpers.DOC_URL}/companies/${this.platform.workspace.company_id}/shared-with-me`,
            headers: {
                authorization: `Bearer ${this.jwt}`,
            },
            payload,
        });

        return deserialize<SearchResultMockClass>(
          SearchResultMockClass,
          response.body)
    };

    async quota() {
        const url = "/internal/services/users/v1/users";

        const response =  await this.platform.app.inject({
            method: "GET",
            headers: { "authorization": `Bearer ${this.jwt}` },
            url: `${url}/${this.user.id}/quota?companyId=${this.platform.workspace.company_id}`,
        })

        return deserialize<UserQuota>(UserQuotaMockClass, response.body)
    }
}

