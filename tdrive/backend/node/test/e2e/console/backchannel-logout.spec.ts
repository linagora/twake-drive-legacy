import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import { v1 as uuidv1 } from "uuid";
import jwt from "jsonwebtoken"; // import jwt for token creation

describe("The /backchannel_logout API", () => {
  const url = "/backchannel_logout";
  let platform: TestPlatform;
  let testDbService: TestDbService;

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
  });

  afterAll(async () => {
    await platform.tearDown();
  });

  it.skip("should 400 when logout_token is missing", async () => {
    const response = await platform.app.inject({
      method: "POST",
      url: url,
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: "logout_token is required",
    });
  });

  it.skip("should 200 when valid logout_token is provided", async () => {
    const session = await testDbService.getSessionByUserId(testDbService.users[0].id);

    const logoutToken = jwt.sign(
      {
        iss: "issuer",
        sub: session.sub,
        sid: session.sid,
        events: {
          "http://schemas.openid.net/event/backchannel-logout": {},
        },
      },
      "your-signing-key", // Replace with your actual signing key
      { algorithm: "HS256" },
    );

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
