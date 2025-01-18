import { Initializable } from "../../../../../core/platform/framework";
import { ClearProcessor } from "./clear";
import { PreviewProcessor } from "./service";
import { Processor } from "src/core/platform/services/message-queue/processor";

/**
 * The notification engine is in charge of processing data and delivering user notifications on the right place
 */
export class PreviewEngine implements Initializable {
  constructor(readonly processor: Processor) {}

  async init(): Promise<this> {
    this.processor.addHandler(new PreviewProcessor());
    this.processor.addHandler(new ClearProcessor());
    return this;
  }
}
