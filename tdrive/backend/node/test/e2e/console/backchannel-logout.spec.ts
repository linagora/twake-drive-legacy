import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import UserApi from "../common/user-api";

describe("The /backchannel_logout API", () => {
  const url = "/internal/services/console/v1/backchannel_logout";
  let platform: TestPlatform;
  let testDbService: TestDbService;
  let currentUser: UserApi;

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

  it("should 400 when logout_token is missing", async () => {
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
    expect(deletedSession).not.toBeNull();
    expect(deletedSession.revoked_at).toBeGreaterThan(0);
  });

  it("should create a session on login", async () => {
    const session = currentUser.session;
    expect(session).not.toBeNull();
    expect(session).not.toBeUndefined();
  });

  it("should receive 401 after logout and trying to access with the same token", async () => {
    const myDriveId = "user_" + currentUser.user.id;

    let response = await currentUser.getDocument(myDriveId);
    expect(response.statusCode).toBe(200);

    await currentUser.logout();

    response = await currentUser.getDocument(myDriveId);
    expect(response.statusCode).toBe(401);
  });

  it("should receive 401 after logout and try to login one more time with the same token", async () => {
    //when
    await currentUser.logout();

    //then
    const response = await currentUser.login(currentUser.session);
    expect(response.statusCode).toBe(401);
  });

  it("should receive 401 after logout successfully after logout", async () => {
    //given
    const myDriveId = "user_" + currentUser.user.id;
    let response = await currentUser.getDocument(myDriveId);
    expect(response.statusCode).toBe(200);

    //when
    await currentUser.logout();

    //then
    response = await currentUser.login(currentUser.session);
    expect(response.statusCode).toBe(401);

    currentUser.jwt = await currentUser.doLogin();


    response = await currentUser.getDocument(myDriveId);
    expect(response.statusCode).toBe(200);
  });

  it("should be able to log-in several times by having multiple sessions", async () => {
    // Perform a second login
    const newUserSession = await UserApi.getInstance(platform);

    //two sessions are different
    expect(newUserSession.session).not.toEqual(currentUser.session);

    // Verify that the user has two sessions
    const oldSession = await testDbService.getSessionById(currentUser.session);
    expect(oldSession).not.toBeNull();
    expect(oldSession.sub).toBe(currentUser.user.id);

    const newSession = await testDbService.getSessionById(newUserSession.session);
    expect(newSession).not.toBeNull();
    expect(newSession.sub).toBe(currentUser.user.id);

    //check that we can send requests for both session
    expect((await currentUser.getDocument("user_" + currentUser.user.id)).statusCode).toEqual(200);
    expect((await newUserSession.getDocument("user_" + currentUser.user.id)).statusCode).toEqual(200);

  });

  it("should logout from one session and still be logged in another", async () => {
    // Perform a second login
    const newUserSession = await UserApi.getInstance(platform);

    await currentUser.logout();

    // Verify session1 is removed
    expect((await currentUser.getDocument("user_" + currentUser.user.id)).statusCode).toEqual(401);
    expect((await newUserSession.getDocument("user_" + currentUser.user.id)).statusCode).toEqual(200);
  });

  it("I want to be able to log-in/recieve access token several time with the same session id", async () => {
    await currentUser.login(currentUser.session);
    await currentUser.login(currentUser.session);

    expect((await currentUser.getDocument("user_" + currentUser.user.id)).statusCode).toEqual(200);
  });

  it("should fail to login with empty session id", async () => {
    const response = await currentUser.login("");
    expect(response.statusCode).toBeDefined();
    expect(response.statusCode).toBe(400);
  });
});
