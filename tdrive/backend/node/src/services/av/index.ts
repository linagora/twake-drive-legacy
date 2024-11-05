import { TdriveService } from "../../core/platform/framework";

export default class AVService extends TdriveService<undefined> {
  version = "1";
  name = "antivirus";

  public async doInit(): Promise<this> {
    return this;
  }

  // TODO: remove
  api(): undefined {
    return undefined;
  }
}
