import S3ConnectorService, {
  S3Configuration
} from "../../../../../../../src/core/platform/services/storage/connectors/S3/s3-service";
import { jest } from "@jest/globals";

describe("The S3ConnectorService", () => {

  beforeEach(async () => {
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("remove shouldnt remove file if the option is disabled", async () => {
    //given
    const subj: S3ConnectorService = new S3ConnectorService({
      disableRemove: true,
      endPoint: "play.min.io",
      port: 9000
    } as S3Configuration);
    const removeSpy = jest.spyOn(subj.client, "removeObject");

    //when
    const result = await subj.remove("path");

    //then
    expect(result).toBeTruthy();
    expect(removeSpy).not.toHaveBeenCalled();
  });

  test("remove should call remove if the option is not disabled", async () => {
    //given
    const subj: S3ConnectorService = new S3ConnectorService({
      disableRemove: false,
      endPoint: "play.min.io",
      port: 9000,
      bucket: "testbucket"
    } as S3Configuration);
    const removeSpy = jest.spyOn(subj.client, "removeObject");
    removeSpy.mockReturnThis();

    //when
    const result = await subj.remove("path");

    //then
    expect(removeSpy).toHaveBeenCalled();
    expect(removeSpy).toBeCalledWith("testbucket", "path");
  });

});