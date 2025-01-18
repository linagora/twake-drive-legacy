import { TdriveService, ServiceName, logger as rootLogger } from "../../framework";
import {
  MessageQueueAdapter,
  MessageQueueListener,
  MessageQueueMessage,
  MessageQueueServiceAPI,
  MessageQueueSubscriptionOptions,
} from "./api";
import { eventBus } from "./bus";
import { Processor } from "./processor";
import adapterFactory from "./factory";
import { SkipCLI } from "../../framework/decorators/skip";
import config from "../../../../core/config";

const logger = rootLogger.child({
  component: "tdrive.core.platform.services.message-queue",
});
@ServiceName("message-queue")
export default class MessageQueue extends TdriveService<MessageQueueServiceAPI> {
  version = "1";
  name = "message-queue";
  service: MessageQueueService;

  async doInit(): Promise<this> {
    this.service = new MessageQueueService(
      //Old config name was "pubsub"
      adapterFactory.create(this.configuration || config.get("pubsub")),
    );
    await this.service.init();

    eventBus.subscribe(message => {
      logger.info(`Event bus publishing message to ${message.topic}`);
      this.service.publish(message.topic, { data: message.data });
    });

    return this;
  }

  async doStart(): Promise<this> {
    await this.service.start();

    return this;
  }

  async doStop(): Promise<this> {
    await this.service.stop();

    return this;
  }

  api(): MessageQueueServiceAPI {
    return this.service;
  }
}

export class MessageQueueService implements MessageQueueServiceAPI {
  version: "1";
  processor: Processor;

  constructor(private adapter: MessageQueueAdapter) {
    this.processor = new Processor(this);
  }

  @SkipCLI()
  async init(): Promise<this> {
    return this;
  }

  @SkipCLI()
  async start(): Promise<this> {
    logger.info("Starting message-queue adapter %o", this.adapter.type);
    await this.adapter?.start?.();
    await this.processor.start();
    logger.info("Initializing message-queue adapter %o", this.adapter.type);
    await this.adapter?.init?.();
    return this;
  }

  @SkipCLI()
  async stop(): Promise<this> {
    logger.info("Stopping message-queue adapter %o", this.adapter.type);
    await this.adapter?.stop?.();
    await this.processor.stop();

    return this;
  }

  publish<T>(topic: string, message: MessageQueueMessage<T>): Promise<void> {
    return this.adapter.publish(topic, message);
  }

  subscribe<T>(
    topic: string,
    listener: MessageQueueListener<T>,
    options?: MessageQueueSubscriptionOptions,
  ): Promise<void> {
    return this.adapter.subscribe(topic, listener, options);
  }
}
