import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { initWithDefaults, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import { v1 as uuidv1 } from "uuid";

describe("The /workspaces API", () => {
  const url = "/internal/services/workspaces/v1";
  let platform: TestPlatform;

  let testDbService: TestDbService;

  const nonExistentId = uuidv1();
  let companyId = "";

  beforeAll(async () => {
    platform = await initWithDefaults();

    companyId = platform.workspace.company_id;

    await platform.database.getConnector().init();
    testDbService = new TestDbService(platform);
    await testDbService.createCompany(companyId, "Company name");
    const ws0pk = { id: uuidv1(), company_id: companyId };
    const ws1pk = { id: uuidv1(), company_id: companyId };
    const ws2pk = { id: uuidv1(), company_id: companyId };
    await testDbService.createWorkspace(ws0pk);
    await testDbService.createWorkspace(ws1pk);
    await testDbService.createWorkspace(ws2pk);
    await testDbService.createUser([ws0pk, ws1pk]);
    await testDbService.createUser([ws2pk], { companyRole: "admin" });
    await testDbService.createUser([ws2pk], { companyRole: undefined, workspaceRole: "moderator" });
    await testDbService.createUser([], { companyRole: "guest" });
  });

  afterAll(async () => {
    await platform.tearDown();
  });

  describe("The GET /workspaces/ route", () => {
    it("should 401 when not authenticated", async () => {
      const response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${nonExistentId}/workspaces`,
      });
      expect(response.statusCode).toBe(401);
    });

    it("should 404 when company not found",  async () => {
      const userId = testDbService.workspaces[0].users[0].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${nonExistentId}/workspaces`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(response.statusCode).toBe(404);
    });

    it("should 200 when company belongs to user", async () => {
      const userId = testDbService.workspaces[0].users[0].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });
      const companyId = testDbService.company.id;
      const response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${companyId}/workspaces`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(response.statusCode).toBe(200);

      const resources = response.json()["resources"];

      expect(resources.length).toBe(2);

      for (const resource of resources) {
        expect(resource).toMatchObject({
          id: expect.any(String),
          company_id: expect.any(String),
          name: expect.any(String),
          logo: expect.any(String),
          default: expect.any(Boolean),
          archived: expect.any(Boolean),
          role: expect.stringMatching(/moderator|member/),
        });

        if (resource.stats) {
          expect(resource.stats).toMatchObject({
            created_at: expect.any(Number),
            total_members: 1,
          });
        }
      }

      
    });
  });

  describe("The GET /workspaces/:workspace_id route", () => {
    it("should 401 when not authenticated", async () => {
      const workspaceId = testDbService.workspaces[0].workspace.id;

      const response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${nonExistentId}/workspaces/${workspaceId}`,
      });
      expect(response.statusCode).toBe(401);
      
    });

    it("should 404 when workspace not found", async () => {
      const userId = testDbService.workspaces[0].users[0].id;
      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${companyId}/workspaces/${uuidv1()}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(response.statusCode).toBe(404);
      
    });

    it("should 403 when user not belong to workspace and not company_admin", async () => {
      const workspaceId = testDbService.workspaces[2].workspace.id;
      const userIdFromAnotherWorkspace = testDbService.workspaces[0].users[0].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userIdFromAnotherWorkspace });

      const response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(response.statusCode).toBe(403);

      expect(response.json()).toEqual({
        error: "Forbidden",
        message: `You are not belong to workspace ${workspaceId}`,
        statusCode: 403,
      });

      
    });

    it("should 200 when user is company_admin", async () => {
      const workspaceId = testDbService.workspaces[0].workspace.id;
      const userIdFromAnotherWorkspace = testDbService.workspaces[2].users[0].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userIdFromAnotherWorkspace });

      const response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(response.statusCode).toBe(200);

      const resource = response.json()["resource"];

      expect(resource).toMatchObject({
        id: expect.any(String),
        company_id: expect.any(String),
        name: expect.any(String),
        logo: expect.any(String),
        default: expect.any(Boolean),
        archived: expect.any(Boolean),
      });

      if (resource.stats) {
        expect(resource.stats).toMatchObject({
          created_at: expect.any(Number),
          total_members: 1,
        });
      }

      
    });

    it("should 200 when user is belong to workspace", async () => {
      const workspaceId = testDbService.workspaces[0].workspace.id;
      const userIdFromThisWorkspace = testDbService.workspaces[0].users[0].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userIdFromThisWorkspace });

      const response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(response.statusCode).toBe(200);

      const resource = response.json()["resource"];

      expect(resource).toMatchObject({
        id: expect.any(String),
        company_id: expect.any(String),
        name: expect.any(String),
        logo: expect.any(String),
        default: expect.any(Boolean),
        archived: expect.any(Boolean),
        role: expect.stringMatching(/moderator|member/),
      });

      if (resource.stats) {
        expect(resource.stats).toMatchObject({
          created_at: expect.any(Number),
          total_members: 1,
        });
      }

      
    });
  });

  // create

  describe("The POST /workspaces route (creating workspace)", () => {
    it("should 401 when not authenticated", async () => {
      const companyId = testDbService.company.id;

      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${nonExistentId}`,
      });
      expect(response.statusCode).toBe(401);
      
    });

    it("should 403 when user is not (company member or company admin) ", async () => {
      const companyId = testDbService.company.id;
      const userId = testDbService.users[3].id;
      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: {
          resource: {
            name: "Some channel name",
            logo: "",
            default: false,
          },
        },
      });

      expect(response.statusCode).toBe(403);
      
    });

    it("should 201 when workspace created well", async () => {
      const companyId = testDbService.company.id;
      const userId = testDbService.users[0].id;
      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: {
          resource: {
            name: "Random channel name",
            logo: "logo",
            default: false,
          },
        },
      });

      expect(response.statusCode).toBe(201);

      const resource = response.json()["resource"];

      expect(resource).toMatchObject({
        id: expect.any(String),
        company_id: expect.any(String),
        name: expect.any(String),
        logo: expect.any(String),
        default: expect.any(Boolean),
        archived: expect.any(Boolean),
        role: expect.stringMatching(/moderator/),
      });

      
    });
  });

  // update

  describe("The POST /workspaces/:workspace_id route (updating workspace)", () => {
    it("should 401 when not authenticated", async () => {
      const companyId = testDbService.company.id;

      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${nonExistentId}`,
        payload: { resource: {} },
      });
      expect(response.statusCode).toBe(401);
      
    });

    it("should 403 when not workspace not found", async () => {
      const companyId = testDbService.company.id;
      const userId = testDbService.workspaces[0].users[0].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${nonExistentId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { resource: {} },
      });

      expect(response.statusCode).toBe(403);

      
    });

    it("should 403 when not belong to workspace", async () => {
      const companyId = testDbService.company.id;
      const workspaceId = testDbService.workspaces[1].workspace.id;
      const userId = testDbService.workspaces[0].users[0].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { resource: {} },
      });

      expect(response.statusCode).toBe(403);

      
    });

    it("should 403 when not workspace moderator", async () => {
      const companyId = testDbService.company.id;
      const workspaceId = testDbService.workspaces[1].workspace.id;
      const userId = testDbService.workspaces[0].users[0].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { resource: {} },
      });

      expect(response.statusCode).toBe(403);

      
    });

    it("should 200 when admin of company (full update)", async () => {
      const companyId = testDbService.company.id;
      const workspaceId = testDbService.workspaces[2].workspace.id;
      const userId = testDbService.workspaces[2].users[0].id; // company owner

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: {
          resource: {
            name: "Another workspace name",
            logo: "logo",
            default: false,
            archived: false,
          },
        },
      });

      expect(response.statusCode).toBe(200);

      const resource = response.json()["resource"];

      expect(resource).toMatchObject({
        id: workspaceId,
        company_id: companyId,
        name: "Another workspace name",
        logo: expect.any(String),
        default: false,
        archived: false,
        role: "moderator", //Company admin is a moderator
      });

      
    });

    it("should 200 when moderator of workspace (partial update)", async () => {
      const companyId = testDbService.company.id;
      const workspaceId = testDbService.workspaces[2].workspace.id;
      const userId = testDbService.workspaces[2].users[1].id; // workspace admin

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: {
          resource: {
            name: "My awesome workspace",
            default: true,
            logo: "",
          },
        },
      });

      expect(response.statusCode).toBe(200);

      const resource = response.json()["resource"];

      expect(resource).toMatchObject({
        id: workspaceId,
        company_id: companyId,
        name: "My awesome workspace",
        logo: expect.any(String),
        default: true,
        archived: false,
        role: "moderator",
      });

      
    });
  });

  // delete

  describe("The DELETE /workspaces route", () => {
    it("should 401 when not authenticated", async () => {
      const companyId = testDbService.company.id;

      const response = await platform.app.inject({
        method: "DELETE",
        url: `${url}/companies/${companyId}/workspaces/${nonExistentId}`,
      });
      expect(response.statusCode).toBe(401);
      
    });

    it("should 403 when user is not (company member or company admin) ", async () => {
      const companyId = testDbService.company.id;
      const userId = testDbService.users[3].id;
      const jwtToken = await platform.auth.getJWTToken({ sub: userId });
      const workspaceId = testDbService.workspaces[0].workspace.id;

      const response = await platform.app.inject({
        method: "DELETE",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });

      expect(response.statusCode).toBe(403);
      
    });

    it("should 204 when workspace deleted", async () => {
      const companyId = testDbService.company.id;
      const workspaceId = testDbService.workspaces[2].workspace.id;
      const userId = testDbService.workspaces[2].users[0].id;
      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "DELETE",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });

      expect(response.statusCode).toBe(204);

      const checkResponse = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${companyId}/workspaces`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });

      const checkResponseJson = checkResponse.json();

      expect(checkResponseJson.resources.find((a: any) => a.id === workspaceId)).toBe(undefined);

      
    });
  });
});
