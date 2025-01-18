import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { deserialize } from "class-transformer";
import { AccessInformation } from "../../../src/services/documents/entities/drive-file";
import { initWithDefaults, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import UserApi from "../common/user-api";

const url = "/internal/services/documents/v1";

describe("the Drive Tdrive tabs feature", () => {
  let platform: TestPlatform;
  let currentUser: UserApi;

  class DriveFileMockClass {
    id: string;
    name: string;
    size: number;
    added: string;
    parent_id: string;
    access_info: AccessInformation;
  }

  class DriveItemDetailsMockClass {
    path: string[];
    item: DriveFileMockClass;
    children: DriveFileMockClass[];
    versions: Record<string, unknown>[];
  }

  beforeEach(async () => {
    platform = await initWithDefaults();
    currentUser = await UserApi.getInstance(platform);
  });

  afterAll(async () => {
    await platform?.tearDown();
    platform = null;
  });

  it("did create a tab configuration on Drive side", async () => {
    await TestDbService.getInstance(platform, true);

    const doc = await currentUser.createDefaultDocument();

    const tab = {
      company_id: platform.workspace.company_id,
      tab_id: "1234567890",
      channel_id: "abcdefghij",
      item_id: doc.id,
      level: "write",
    };

    const token = await platform.auth.getJWTToken();

    const createdTab = await platform.app.inject({
      method: "POST",
      url: `${url}/companies/${platform.workspace.company_id}/tabs/${tab.tab_id}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: tab,
    });

    expect(createdTab.statusCode).toBe(200);
    expect(createdTab.body).toBeDefined();
    expect(createdTab.json().company_id).toBe(tab.company_id);
    expect(createdTab.json().tab_id).toBe(tab.tab_id);
    expect(createdTab.json().item_id).toBe(tab.item_id);

    const getTabResponse = await platform.app.inject({
      method: "GET",
      url: `${url}/companies/${platform.workspace.company_id}/tabs/${tab.tab_id}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(getTabResponse.statusCode).toBe(200);
    expect(getTabResponse.body).toBeDefined();
    expect(getTabResponse.json().company_id).toBe(tab.company_id);
    expect(getTabResponse.json().tab_id).toBe(tab.tab_id);
    expect(getTabResponse.json().item_id).toBe(tab.item_id);

    const documentResponse = await currentUser.getDocument(doc.id);
    const documentResult = deserialize<DriveItemDetailsMockClass>(
      DriveItemDetailsMockClass,
      documentResponse.body,
    );

    console.log(documentResult?.item);

    expect(
      documentResult?.item?.access_info?.entities?.find(
        a => a?.type === "channel" && a.id === "abcdefghij" && a.level === "write",
      ),
    ).toBeDefined();
  });

  it("did refuse to create a tab configuration for an item I can't manage", async () => {
    const dbService = await TestDbService.getInstance(platform, true);
    const ws0pk = {
      id: platform.workspace.workspace_id,
      company_id: platform.workspace.company_id,
    };
    const otherUser = await dbService.createUser([ws0pk]);

    const doc = await currentUser.createDefaultDocument();

    const tab = {
      company_id: platform.workspace.company_id,
      tab_id: "1234567890",
      channel_id: "abcdefghij",
      item_id: doc.id,
      level: "read",
    };

    const token = await platform.auth.getJWTToken({ sub: otherUser.id });

    const createdTab = await platform.app.inject({
      method: "POST",
      url: `${url}/companies/${platform.workspace.company_id}/tabs/${tab.tab_id}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: tab,
    });

    expect(createdTab.statusCode).toBe(403);
  });
});
