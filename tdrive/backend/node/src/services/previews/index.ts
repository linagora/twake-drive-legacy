import { Consumes, Prefix, TdriveService } from "../../core/platform/framework";
import { PreviewEngine } from "./services/files/engine";
import { MessageQueueServiceAPI } from "src/core/platform/services/message-queue/api";

@Prefix("/internal/services/previews/v1")
@Consumes(["message-queue", "files"])
export default class PreviewsService extends TdriveService<undefined> {
  version = "1";
  name = "previews";

  public async doInit(): Promise<this> {
    return this;
  }

  // TODO: remove
  api(): undefined {
    return undefined;
  }

  async doStart(): Promise<this> {
    await new PreviewEngine(
      this.context.getProvider<MessageQueueServiceAPI>("message-queue").processor,
    ).init();
    return this;
  }
}
