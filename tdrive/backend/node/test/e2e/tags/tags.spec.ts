import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { initWithDefaults, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import { Tag } from "../../../src/services/tags/entities/tags";
import { deserialize } from "class-transformer";
import {
  ResourceCreateResponse,
  ResourceGetResponse,
  ResourceListResponse,
} from "../../../src/utils/types";

describe("The Tag feature", () => {
  const url = "/internal/services/tags/v1";
  let platform: TestPlatform;
  let testDbService: TestDbService;
  const tagIds: string[] = [];

  beforeAll(async () => {
    platform = await initWithDefaults();
    testDbService = await TestDbService.getInstance(platform, true);
  });

  afterAll(async () => {
    for (let i = 0; i < tagIds.length; i++) {
      for (let j = 0; j < tagIds.length; j++) {
        if (tagIds[j] === tagIds[i] && j !== i) {
          throw new Error("Tag are not unique");
        }
      }
    }
    await platform?.tearDown();
    platform = null;
  });

  describe("Create tag", () => {
    it("should 201 if creator is a company admin", async () => {
      const user = await testDbService.createUser([testDbService.defaultWorkspace()], {
        companyRole: "admin",
      });

      const jwtToken = await platform.auth.getJWTToken({ sub: user.id });

      for (let i = 0; i < 3; i++) {
        const createTag = await platform.app.inject({
          method: "POST",
          url: `${url}/companies/${platform.workspace.company_id}/tags`,
          headers: {
            authorization: `Bearer ${jwtToken}`,
          },
          payload: {
            name: `test${i}`,
            colour: `#00000${i}`,
          },
        });

        const tagResult: ResourceCreateResponse<Tag> = deserialize<ResourceCreateResponse<Tag>>(
          ResourceCreateResponse,
          createTag.body,
        );
        expect(createTag.statusCode).toBe(201);
        expect(tagResult.resource).toBeDefined();
        expect(tagResult.resource.name).toBe(`test${i}`);
        expect(tagResult.resource.colour).toBe(`#00000${i}`);
        expect(tagResult.resource.company_id).toBe(platform.workspace.company_id);
        expect(tagResult.resource.tag_id).toBe(`test${i}`);

        const getTag = await platform.app.inject({
          method: "GET",
          url: `${url}/companies/${platform.workspace.company_id}/tags/${tagResult.resource.tag_id}`,
          headers: {
            authorization: `Bearer ${jwtToken}`,
          },
        });
        expect(getTag.statusCode).toBe(200);

        tagIds.push(tagResult.resource.tag_id);
      }
    });

    it("should 401 if creator is not a company admin", async () => {
      const user = await testDbService.createUser([testDbService.defaultWorkspace()], {
        companyRole: "member",
      });
      const jwtToken = await platform.auth.getJWTToken({ sub: user.id });
      const createTag = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${platform.workspace.company_id}/tags`,
        headers: {
          authorization: `Bearer ${jwtToken}`,
        },
        payload: {
          name: "testNotAdmin",
          colour: "#000000",
        },
      });
      expect(createTag.statusCode).toBe(401);

      const tagResult: ResourceCreateResponse<Tag> = deserialize<ResourceCreateResponse<Tag>>(
        ResourceCreateResponse,
        createTag.body,
      );
      expect(tagResult.resource).toBe(undefined);
    });
  });

  describe("Get tag", () => {
    it("should 200 get a tag", async () => {
      const user = await testDbService.createUser([testDbService.defaultWorkspace()], {
        companyRole: "member",
      });
      const jwtToken = await platform.auth.getJWTToken({ sub: user.id });
      const getTag = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${platform.workspace.company_id}/tags/${tagIds[0]}`,
        headers: {
          authorization: `Bearer ${jwtToken}`,
        },
      });
      expect(getTag.statusCode).toBe(200);

      const getResult: ResourceGetResponse<Tag> = deserialize<ResourceGetResponse<Tag>>(ResourceGetResponse, getTag.body);
      expect(getResult.resource).toBeDefined();
      expect(getResult.resource.name).toBe("test0");
      expect(getResult.resource.colour).toBe("#000000");
      expect(getResult.resource.company_id).toBe(platform.workspace.company_id);

      
    });

    it("should 200 tag does not exist", async () => {
      const user = await testDbService.createUser([testDbService.defaultWorkspace()], {
        companyRole: "member",
      });
      const jwtToken = await platform.auth.getJWTToken({ sub: user.id });
      const getTag = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${platform.workspace.company_id}/tags/NonExistingTag`,
        headers: {
          authorization: `Bearer ${jwtToken}`,
        },
      });
      expect(getTag.statusCode).toBe(200);

      const getResult: ResourceGetResponse<Tag> = deserialize<ResourceGetResponse<Tag>>(ResourceGetResponse, getTag.body);
      expect(getResult.resource).toBe(null);

      
    });
  });

  describe("Update tag", () => {
    it("Should 204 if user is admin", async () => {
      const user = await testDbService.createUser([testDbService.defaultWorkspace()], {
        companyRole: "admin",
      });
      const jwtToken = await platform.auth.getJWTToken({ sub: user.id });
      const updateTag = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${platform.workspace.company_id}/tags`,
        headers: {
          authorization: `Bearer ${jwtToken}`,
        },
        payload: {
          name: "test1",
          colour: "#000003",
        },
      });
      expect(updateTag.statusCode).toBe(201);

      const tagUpdatedResult: ResourceCreateResponse<Tag> = deserialize<ResourceCreateResponse<Tag>>(
        ResourceCreateResponse,
        updateTag.body,
      );
      expect(tagUpdatedResult.resource).toBeDefined();
      expect(tagUpdatedResult.resource.name).toBe("test1");
      expect(tagUpdatedResult.resource.colour).toBe("#000003");
      expect(tagUpdatedResult.resource.company_id).toBe(platform.workspace.company_id);
      expect(tagUpdatedResult.resource.tag_id).toBe("test1");

      const getUpdatedTag = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${platform.workspace.company_id}/tags/${tagUpdatedResult.resource.tag_id}`,
        headers: {
          authorization: `Bearer ${jwtToken}`,
        },
      });
      expect(getUpdatedTag.statusCode).toBe(200);

      
    });

    it("should 401 if creator is not a company admin", async () => {
      const user = await testDbService.createUser([testDbService.defaultWorkspace()], {
        companyRole: "member",
      });
      const jwtToken = await platform.auth.getJWTToken({ sub: user.id });
      const createTag = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${platform.workspace.company_id}/tags/testNotAdmin`,
        headers: {
          authorization: `Bearer ${jwtToken}`,
        },
        payload: {
          name: "testNotAdmin",
          colour: "#000000",
        },
      });
      expect(createTag.statusCode).toBe(401);

      const tagResult: ResourceCreateResponse<any> = deserialize(
        ResourceCreateResponse,
        createTag.body,
      );
      console.log("tagResult2", tagResult, jwtToken);
      expect(tagResult.resource).toBe(undefined);

      
    });
  });

  describe("List tags", () => {
    it("should 200 list a tag", async () => {
      const user = await testDbService.createUser([testDbService.defaultWorkspace()], {
        companyRole: "member",
      });
      const jwtToken = await platform.auth.getJWTToken({ sub: user.id });
      const listTag = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${platform.workspace.company_id}/tags`,
        headers: {
          authorization: `Bearer ${jwtToken}`,
        },
      });
      expect(listTag.statusCode).toBe(200);

      const tagResult: ResourceListResponse<any> = deserialize(ResourceListResponse, listTag.body);
      expect(tagResult.resources).toBeDefined();
      for (const tag of tagResult.resources) {
        expect(tag.name).toBeDefined();
        expect(tag.colour).toBeDefined();
        expect(tag.company_id).toBe(platform.workspace.company_id);
        expect(tag.tag_id).toBeDefined();
      }

      
    });
  });

  describe("Delete tag", () => {
    it("should 200 if admin delete a tag", async () => {
      const user = await testDbService.createUser([testDbService.defaultWorkspace()], {
        companyRole: "admin",
      });
      const jwtToken = await platform.auth.getJWTToken({ sub: user.id });
      const deleteTag = await platform.app.inject({
        method: "DELETE",
        url: `${url}/companies/${platform.workspace.company_id}/tags/${tagIds[0]}`,
        headers: {
          authorization: `Bearer ${jwtToken}`,
        },
      });
      expect(deleteTag.statusCode).toBe(200);

      
    });

    it("should 200 if tag does not exist", async () => {
      const user = await testDbService.createUser([testDbService.defaultWorkspace()], {
        companyRole: "admin",
      });
      const jwtToken = await platform.auth.getJWTToken({ sub: user.id });
      const deleteTag = await platform.app.inject({
        method: "DELETE",
        url: `${url}/companies/${platform.workspace.company_id}/tags/NonExistingTag`,
        headers: {
          authorization: `Bearer ${jwtToken}`,
        },
      });
      expect(deleteTag.statusCode).toBe(200);
      
    });

    it("should 401 if not admin", async () => {
      const user = await testDbService.createUser([testDbService.defaultWorkspace()], {
        companyRole: "member",
      });
      const jwtToken = await platform.auth.getJWTToken({ sub: user.id });
      const deleteTag = await platform.app.inject({
        method: "DELETE",
        url: `${url}/companies/${platform.workspace.company_id}/tags/${tagIds[0]}`,
        headers: {
          authorization: `Bearer ${jwtToken}`,
        },
      });
      expect(deleteTag.statusCode).toBe(401);
      
    });
  });
});
