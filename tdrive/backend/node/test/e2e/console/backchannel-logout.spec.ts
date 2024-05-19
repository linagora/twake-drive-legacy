import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import { v1 as uuidv1 } from "uuid";
import { OidcJwtVerifier } from "../../../src/services/console/clients/remote-jwks-verifier";

describe("The /backchannel_logout API", () => {
  const url = "/internal/services/console/v1/backchannel_logout";
  let platform: TestPlatform;
  let testDbService: TestDbService;
  let verifierMock;

  beforeEach(async () => {
    platform = await init();
  });

  afterEach(async () => {
    await platform.tearDown();
    platform = null;
  });

  beforeAll(async () => {
    platform = await init({
      services: [
        "database",
        "search",
        "message-queue",
        "websocket",
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

    testDbService = await TestDbService.getInstance(platform);
    await testDbService.createCompany();
    const workspacePk = { id: uuidv1(), company_id: testDbService.company.id };
    await testDbService.createWorkspace(workspacePk);
    await testDbService.createUser([workspacePk], {
      workspaceRole: "moderator",
      companyRole: "admin",
      email: "admin@admin.admin",
      username: "adminuser",
      firstName: "admin",
    });
    await testDbService.createUser([workspacePk]);

    // Add a session to the database
    const session = {
      sid: uuidv1(),
      sub: testDbService.users[0].id,
      // Add other session fields as needed
    };
    await testDbService.createSession(session.sid, session.sub);

    const payload = {
      iss: "tdrive_lemonldap",
      sub: session.sub,
      sid: session.sid,
      aud: "your-audience",
      iat: Math.floor(Date.now() / 1000),
      jti: "jwt-id",
      events: {
        "http://schemas.openid.net/event/backchannel-logout": {},
      },
    };
    verifierMock = jest.spyOn(OidcJwtVerifier.prototype, "verifyLogoutToken");
    verifierMock.mockImplementation(() => {
      return Promise.resolve(payload); // Return the predefined payload
    });
  });

  afterAll(async () => {
    await platform?.tearDown();
    platform = null;
  });

  it.skip("should 400 when logout_token is missing", async () => {
    const response = await platform.app.inject({
      method: "POST",
      url: url,
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Missing logout_token",
    });
  });

  it("should 200 when valid logout_token is provided", async () => {
    const session = await testDbService.getSessionByUserId(testDbService.users[0].id);
    const logoutToken = "logout_token_rsa256";

    const response = await platform.app.inject({
      method: "POST",
      url: url,
      payload: {
        logout_token: logoutToken,
      },
    });
    expect(response.statusCode).toBe(200);

    // Verify the session is removed from the database
    const deletedSession = await testDbService.getSessionById(session.sid);
    expect(deletedSession).toBeNull();
  });
});
