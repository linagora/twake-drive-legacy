import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import { TestDbService, uuid } from "../utils.prepare.db";
import { v1 as uuidv1 } from "uuid";

describe("The /workspace users API", () => {
  const url = "/internal/services/workspaces/v1";
  let platform: TestPlatform;

  let testDbService: TestDbService;

  const nonExistentId = uuidv1();
  let companyId = "";

  const checkUserObject = (resource: any) => {
    expect(resource).toMatchObject({
      id: expect.any(String),
      company_id: expect.any(String),
      workspace_id: expect.any(String),
      user_id: expect.any(String),
      created_at: expect.any(Number),
      role: expect.stringMatching(/moderator|member/),
      user: {
        id: expect.any(String),
        provider: expect.any(String),
        provider_id: expect.any(String),
        email: expect.any(String),
        is_verified: expect.any(Boolean),
        picture: expect.any(String),
        first_name: expect.any(String),
        last_name: expect.any(String),
        created_at: expect.any(Number),
        deleted: expect.any(Boolean),
        status: expect.any(String),
        last_activity: expect.any(Number),
      },
    });
  };

  beforeAll(async () => {
    platform = await init({
      services: [
        "database",
        "message-queue",
        "search",
        "webserver",
        "user",
        "workspaces",
        "applications",
        "auth",
        "console",
        "counter",
        "storage",
        "statistics",
        "platform-services",
      ],
    });

    companyId = platform.workspace.company_id;

    await platform.database.getConnector().init();
    testDbService = new TestDbService(platform);
    await testDbService.createCompany(companyId);
    const ws0pk = { id: uuidv1(), company_id: companyId };
    const ws1pk = { id: uuidv1(), company_id: companyId };
    const ws2pk = { id: uuidv1(), company_id: companyId };
    const ws3pk = { id: uuidv1(), company_id: companyId };
    await testDbService.createWorkspace(ws0pk);
    await testDbService.createWorkspace(ws1pk);
    await testDbService.createWorkspace(ws2pk);
    await testDbService.createWorkspace(ws3pk);
    await testDbService.createUser([ws0pk, ws1pk]);
    await testDbService.createUser([ws2pk], { companyRole: "admin" });
    await testDbService.createUser([ws2pk], { workspaceRole: "moderator" });
    await testDbService.createUser([ws2pk], { workspaceRole: "member" });
    await testDbService.createUser([ws2pk], { workspaceRole: "member" });
    await testDbService.createUser([], { companyRole: "member" });
    await testDbService.createUser([ws3pk], { companyRole: "guest", workspaceRole: "member" });
  });

  afterAll(async () => {
    await platform.tearDown();
  });

  describe("The GET /workspaces/users route", () => {
    it("should 401 when not authenticated", async () => {
      const companyId = testDbService.company.id;

      const response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${companyId}/workspaces/${nonExistentId}/users`,
      });
      expect(response.statusCode).toBe(401);
      
    });

    it("should 404 when workspace not found", async () => {
      const userId = testDbService.users[0].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${companyId}/workspaces/${nonExistentId}/users`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(response.statusCode).toBe(404);
      
    });

    it("should 200 when ok", async () => {
      const companyId = testDbService.company.id;
      const workspaceId = testDbService.workspaces[2].workspace.id;
      const userId = testDbService.workspaces[2].users[0].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });
      const response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}/users`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(response.statusCode).toBe(200);

      const resources = response.json()["resources"];

      expect(resources.length).toBeGreaterThan(0);

      for (const resource of resources) {
        checkUserObject(resource);
      }

      
    });
  });

  describe("The GET /workspaces/users/:user_id route",  () => {
    it("should 401 when not authenticated", async () => {
      const companyId = testDbService.company.id;
      const userId = testDbService.users[0].id;

      const response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${companyId}/workspaces/${nonExistentId}/users/${userId}`,
      });
      expect(response.statusCode).toBe(401);
      
    });

    it("should 404 when workspace not found", async () => {
      const userId = testDbService.users[0].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${companyId}/workspaces/${nonExistentId}/users/${userId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(response.statusCode).toBe(404);
      
    });

    it("should 200 when ok", async () => {
      const companyId = testDbService.company.id;
      const workspaceId = testDbService.workspaces[0].workspace.id;
      const userId = testDbService.workspaces[0].users[0].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });
      const response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}/users/${userId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });
      expect(response.statusCode).toBe(200);

      const resource = response.json()["resource"];
      checkUserObject(resource);
      
    });
  });

  describe("The POST /workspaces/users route (add)", () => {
    it("should 401 when not authenticated", async () => {
      const companyId = testDbService.company.id;

      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${nonExistentId}/users`,
      });
      expect(response.statusCode).toBe(401);
      
    });

    it("should 403 user is not workspace moderator", async () => {
      const userId = testDbService.users[0].id;
      const anotherUserId = testDbService.users[1].id;
      const workspaceId = testDbService.workspaces[0].workspace.id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}/users`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: {
          resource: {
            user_id: anotherUserId,
            role: "moderator",
          },
        },
      });
      expect(response.statusCode).toBe(403);
      
    });

    it("should 400 when requested user not in company", async () => {
      const companyId = testDbService.company.id;
      const workspaceId = testDbService.workspaces[2].workspace.id;
      const userId = testDbService.workspaces[2].users[1].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });
      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}/users`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: {
          resource: {
            user_id: nonExistentId,
            role: "moderator",
          },
        },
      });
      expect(response.statusCode).toBe(400);
      
    });

    it("should 201 when requested already in workspace (ignore)", async () => {
      const companyId = testDbService.company.id;
      const workspaceId = testDbService.workspaces[2].workspace.id;
      const userId = testDbService.workspaces[2].users[1].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });
      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}/users`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: {
          resource: {
            user_id: userId,
            role: "moderator",
          },
        },
      });
      expect(response.statusCode).toBe(201);
      
    });

    it("should 200 when ok", async () => {
      const companyId = testDbService.company.id;
      const workspaceId = testDbService.workspaces[2].workspace.id;
      const userId = testDbService.workspaces[2].users[1].id;
      const anotherUserId = testDbService.workspaces[0].users[0].id;

      let workspaceUsersCount = await testDbService.getWorkspaceUsersCountFromDb(workspaceId);

      console.log(testDbService.workspaces[2].users);
      console.log(workspaceUsersCount);

      expect(workspaceUsersCount).toBe(4);
      // expect(companyUsersCount).toBe(6);

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });
      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}/users`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: {
          resource: {
            user_id: anotherUserId,
            role: "moderator",
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const resource = response.json()["resource"];
      checkUserObject(resource);
    });
  });

  describe("The POST /workspaces/users/:user_id route (update)",  () => {
    it("should 401 when not authenticated", async () => {
      const companyId = testDbService.company.id;
      const userId = testDbService.users[0].id;

      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${nonExistentId}/users/${userId}`,
      });
      expect(response.statusCode).toBe(401);
      
    });

    it("should 403 user is not workspace moderator", async () => {
      const userId = testDbService.users[0].id;
      const anotherUserId = testDbService.users[1].id;
      const workspaceId = testDbService.workspaces[0].workspace.id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}/users/${userId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: {
          resource: {
            user_id: anotherUserId,
            role: "moderator",
          },
        },
      });
      expect(response.statusCode).toBe(403);
      
    });

    it("should 404 when user not found in workspace", async () => {
      const workspaceId = testDbService.workspaces[2].workspace.id;
      const userId = testDbService.workspaces[2].users[1].id;
      const anotherWorkspaceUserId = testDbService.workspaces[3].users[0].id;
      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}/users/${anotherWorkspaceUserId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: {
          resource: {
            role: "moderator",
          },
        },
      });

      expect(response.statusCode).toBe(404);
      
    });

    it("should 200 when ok", async () => {
      const companyId = testDbService.company.id;
      const workspaceId = testDbService.workspaces[2].workspace.id;
      const userId = testDbService.workspaces[2].users[1].id;
      const anotherUserId = testDbService.workspaces[2].users[2].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });
      const response = await platform.app.inject({
        method: "POST",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}/users/${anotherUserId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: {
          resource: {
            role: "moderator",
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const resource = response.json()["resource"];
      checkUserObject(resource);

      expect(resource["role"]).toBe("moderator");

      const usersCount = await testDbService.getWorkspaceUsersCountFromDb(workspaceId);
      expect(usersCount).toBe(5);

      
    });
  });

  describe("The DELETE /workspaces/users/:user_id route",  () => {
    it("should 401 when not authenticated", async () => {
      const companyId = testDbService.company.id;
      const anotherUserId = testDbService.users[1].id;

      const response = await platform.app.inject({
        method: "DELETE",
        url: `${url}/companies/${companyId}/workspaces/${nonExistentId}/users/${anotherUserId}`,
      });
      expect(response.statusCode).toBe(401);
      
    });

    it("should 403 user is not workspace moderator", async () => {
      const companyId = testDbService.company.id;
      const workspaceId = testDbService.workspaces[2].workspace.id;
      const userId = testDbService.workspaces[2].users[3].id;
      const anotherUserId = testDbService.workspaces[2].users[1].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });

      const response = await platform.app.inject({
        method: "DELETE",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}/users/${anotherUserId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });

      console.log(response.body);

      expect(response.statusCode).toBe(403);
      
    });

    it("should 404 when user not found in workspace", async () => {
      const companyId = testDbService.company.id;
      const workspaceId = testDbService.workspaces[2].workspace.id;
      const userId = testDbService.workspaces[2].users[1].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });
      const response = await platform.app.inject({
        method: "DELETE",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}/users/${nonExistentId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });

      expect(response.statusCode).toBe(404);

      
    });

    it("should 200 when ok", async () => {
      const companyId = testDbService.company.id;
      const workspaceId = testDbService.workspaces[2].workspace.id;
      const userId = testDbService.workspaces[2].users[1].id;
      const anotherUserId = testDbService.workspaces[2].users[2].id;

      const jwtToken = await platform.auth.getJWTToken({ sub: userId });
      let response = await platform.app.inject({
        method: "DELETE",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}/users/${anotherUserId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });

      expect(response.statusCode).toBe(204);

      response = await platform.app.inject({
        method: "GET",
        url: `${url}/companies/${companyId}/workspaces/${workspaceId}/users`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });

      expect(response.statusCode).toBe(200);
      const resources = response.json()["resources"];
      expect(resources.find((a: { user_id: uuid }) => a.user_id === anotherUserId)).toBeUndefined();

      const usersCount = await testDbService.getWorkspaceUsersCountFromDb(workspaceId);
      expect(usersCount).toBe(4);

      
    });
  });
});
