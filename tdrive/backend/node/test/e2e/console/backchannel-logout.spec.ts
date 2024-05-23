import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import { v1 as uuidv1 } from "uuid";
import UserApi from "../common/user-api";
import exp from "constants";

describe("The /backchannel_logout API", () => {
  const url = "/internal/services/console/v1/backchannel_logout";
  let platform: TestPlatform;
  let testDbService: TestDbService;
  let currentUser;

  beforeEach(async () => {
    platform = await init();
    currentUser = await UserApi.getInstance(platform);
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
  });

  afterAll(async () => {
    await platform.tearDown();
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
    const response = await currentUser.logout();
    expect(response.statusCode).toBeDefined();
    expect(response.statusCode).toBe(200);

    // Verify the session is removed from the database
    const deletedSession = await currentUser.dbService.getSessionById(currentUser.session);
    expect(deletedSession).toBeNull();
  });

  it("should create a session on login", async () => {
    const session = currentUser.session;
    expect(session).not.toBeNull();
    expect(session).not.toBeUndefined();
  });

  it("should recieve 401 after logout and trying to access with the same token", async () => {
    const myDriveId = "user_" + currentUser.user.id;
    await currentUser.logout();

    const response = await currentUser.getDocument(myDriveId);
    expect(response.statusCode).toBe(401);
  });

  it("should be able to log-in several times by having multiple sessions", async () => {
    const userId = currentUser.user.id;
    const oldSessionId = currentUser.session;

    // Perform a second login
    await currentUser.login();
    const newSessionId = currentUser.session;

    // Verify that the user has two sessions
    const oldSession = await testDbService.getSessionById(oldSessionId);
    expect(oldSession).not.toBeNull();
    expect(oldSession.sub).toBe(userId);
    const newSession = await testDbService.getSessionById(newSessionId);
    expect(newSession).not.toBeNull();
    expect(newSession.sub).toBe(userId);
  });

  it("should logout from one session and still be logged in another", async () => {
    const userId = currentUser.id;
    const session2 = { sid: uuidv1(), sub: userId };

    await testDbService.createSession(session2.sid, session2.sub);

    await currentUser.logout();

    // Verify session1 is removed
    const deletedSession1 = await testDbService.getSessionById(currentUser.session);
    expect(deletedSession1).toBeNull();

    // Verify session2 still exists
    const existingSession2 = await testDbService.getSessionById(session2.sid);
    expect(existingSession2).not.toBeNull();
  });

  //I want to be able to log-in/recieve access token several time with the same session id
});
