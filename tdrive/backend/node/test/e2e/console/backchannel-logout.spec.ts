import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import { v1 as uuidv1 } from "uuid";
import { OidcJwtVerifier } from "../../../src/services/console/clients/remote-jwks-verifier";
import UserApi from "../common/user-api";

describe("The /backchannel_logout API", () => {
  const url = "/internal/services/console/v1/backchannel_logout";
  let platform: TestPlatform;
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
    const response = currentUser.logout();
    expect(response.statusCode).toBe(200);

    // Verify the session is removed from the database
    const deletedSession = await currentUser.dbService.getSessionById(currentUser.session);
    expect(deletedSession).toBeNull();
  });

  //TODO
  //create a session

  //I should recieve 401 after logout and trying to access with the same token

  //The same user can have multiple session, so I want to be able to log-in several times

  //I want to be able to loging in multiple browser, log-out from on and still be logged in in another

  //I want to be able to log-in/recieve access token several time with the same session id

});
