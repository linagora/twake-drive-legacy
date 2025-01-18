import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { initWithDefaults, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import { v1 as uuidv1 } from "uuid";

describe("The /users API", () => {
  const url = "/internal/services/users/v1";
  let platform: TestPlatform;

  beforeEach(async () => {
    platform = await initWithDefaults();
  });

  afterEach(async () => {
    platform && (await platform.tearDown());
    platform = null;
  });

  describe("The GET /users/?search=... route", () => {
    it("Should find the searched users", async () => {
      const testDbService = new TestDbService(platform);
      await testDbService.createCompany(platform.workspace.company_id);
      const workspacePk = {
        id: platform.workspace.workspace_id,
        company_id: platform.workspace.company_id,
      };
      const workspacePk2 = {
        id: uuidv1(),
        company_id: uuidv1(),
      };
      await testDbService.createWorkspace(workspacePk);
      await testDbService.createWorkspace(workspacePk2);
      await testDbService.createUser([workspacePk], {
        firstName: "Ha",
        lastName: "Nguyen",
        email: "hnguyen@tdrive.app",
      });
      await testDbService.createUser([workspacePk], {
        firstName: "Harold",
        lastName: "Georges",
        email: "hgeorges@tdrive.app",
      });
      await testDbService.createUser([workspacePk], {
        firstName: "Bob",
        lastName: "Smith",
        email: "bob@tdrive.app",
      });
      await testDbService.createUser([workspacePk], {
        firstName: "Bob",
        lastName: "Rabiot",
        email: "rabiot.b@tdrive.app",
      });
      await testDbService.createUser([workspacePk, workspacePk2], {
        firstName: "Bob",
        lastName: "Smith-Rabiot",
        email: "rbs@tdrive.app",
      });
      await testDbService.createUser([workspacePk], {
        firstName: "Alexïs",
        lastName: "Goélâns",
        email: "alexis.goelans@tdrive.app",
      });

      //Wait for indexation to happen
      await new Promise(r => setTimeout(r, 5000));

      let resources = await search("ha", platform.workspace.company_id);
      expect(resources.length).toBe(2);

      resources = await search("bob rabiot");

      expect(resources.map(e => e.email).includes("rabiot.b@tdrive.app")).toBe(true);
      expect(resources.map(e => e.email).includes("rbs@tdrive.app")).toBe(true);
      expect(resources.map(e => e.email).includes("bob@tdrive.app")).toBe(true);

      resources = await search("alexis");
      expect(resources[0].email).toBe("alexis.goelans@tdrive.app");

      resources = await search("ALEXIS");
      expect(resources[0].email).toBe("alexis.goelans@tdrive.app");

      resources = await search("AleXis");
      expect(resources[0].email).toBe("alexis.goelans@tdrive.app");

      resources = await search("alex");
      expect(resources[0].email).toBe("alexis.goelans@tdrive.app");

      resources = await search("àlèXïs");
      expect(resources[0].email).toBe("alexis.goelans@tdrive.app");

      resources = await search("rbs");
      expect(resources[0].email).toBe("rbs@tdrive.app");

      resources = await search("rbs@tdrive.app");
      expect(resources[0].email).toBe("rbs@tdrive.app");

      resources = await search("bob", workspacePk2.company_id);
      expect(resources.length).toBe(1);

      resources = await search("rbs@tdrive.app", workspacePk.company_id);
      expect(resources[0].email).toBe("rbs@tdrive.app");

      resources = await search("rbs@tdrive.app", uuidv1());
      expect(resources.length).toBe(0);

    }, 1200000);
  });

  async function search(search: string, companyId?: string): Promise<any[]> {
    const jwtToken = await platform.auth.getJWTToken();
    const response = await platform.app.inject({
      method: "GET",
      url: `${url}/users`,
      headers: {
        authorization: `Bearer ${jwtToken}`,
      },
      query: {
        search: search,
        ...(companyId ? { search_company_id: companyId } : {}),
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json).toMatchObject({ resources: expect.any(Array) });
    const resources = json.resources;
    return resources;
  }
});
