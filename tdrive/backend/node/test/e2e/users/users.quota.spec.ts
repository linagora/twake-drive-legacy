import { afterAll, afterEach, beforeEach, describe, expect} from "@jest/globals";
import { init, initWithDefaults, TestPlatform } from "../setup";
import UserApi from "../common/user-api";

describe("The /users/quota API", () => {
  let platform: TestPlatform;
  let currentUser: UserApi;

  beforeEach(async () => {
    platform = await initWithDefaults();
    currentUser = await UserApi.getInstance(platform);
  });

  afterEach(async () => {
    await platform.tearDown();
    platform = null;
  });

  afterAll(async () => {
  });


  test("should reutrn 200 with available quota", async () => {
    //given
    const userQuota = 200000000;
    const doc = await currentUser.createDocumentFromFilename("sample.png", "user_" + currentUser.user.id)

    //when
    const quota = await currentUser.quota();

    expect(quota.total).toBe(userQuota);
    expect(quota.remaining).toBe(userQuota - doc.size); //198346196 //198342406
    expect(quota.used).toBe(doc.size);
  });

  test("should return 200 with all empty space", async () => {
    //given
    const userQuota = 200000000;

    //when
    const quota = await currentUser.quota();

    expect(quota.total).toBe(userQuota);
    expect(quota.remaining).toBe(userQuota); //198346196 //198342406
    expect(quota.used).toBe(0);
  });

});
