import StorageService from "../../../../../../src/core/platform/services/storage/storage-service";
import { jest } from "@jest/globals";
import { TdriveServiceConfiguration } from "../../../../../../src/core/platform/framework";

describe("The StorageService", () => {

  beforeEach(async () => {
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("StorageService constructor should throw an exception for S3 storage configuration when home directory starts with trailing slash", async () => {
    //when
    expect(() => {
      new StorageService({
        configuration: {
          get(name: string){
            if (name === "type") return "S3";
            if (name === "S3.homeDirectory") return "/my_mock_folder";
            return null;
          }
        } as TdriveServiceConfiguration,
        name: "MockStorageService",
      })
    }).toThrow("For S3 connector home directory MUST NOT start with '/'");

  });

});