import globalResolver from "../../../global-resolver";
import { logger } from "../../../../core/platform/framework";
import { localEventBus } from "../../../../core/platform/framework/event-bus";
import { Initializable } from "../../../../core/platform/framework";
import { DocumentEvents, NotificationPayloadType, eventToTemplateMap } from "../../types";
import { DocumentsProcessor } from "./extract-keywords";
import Repository from "../../../../core/platform/services/database/services/orm/repository/repository";
import { DriveFile, TYPE } from "../../entities/drive-file";
import { DocumentsFinishedProcess } from "./save-keywords";
import { generateEncodedUrlComponents } from "../../utils";

export class DocumentsEngine implements Initializable {
  private documentRepository: Repository<DriveFile>;

  async DispatchDocumentEvent(e: NotificationPayloadType, event: string) {
    const sender = await globalResolver.services.users.get({ id: e.notificationEmitter });
    const receiver = await globalResolver.services.users.get({ id: e.notificationReceiver });
    const company = await globalResolver.services.companies.getCompany({
      id: e.context.company.id,
    });
    const language = receiver.preferences?.language || "en";

    const emailTemplate = eventToTemplateMap[event];

    if (!emailTemplate) {
      logger.error(`Error dispatching document event. Unknown event type: ${event}`);
      return; // Early return on unknown event type
    }
    const urlComponents = generateEncodedUrlComponents(e, receiver.id);

    try {
      const { html, text, subject } = await globalResolver.platformServices.emailPusher.build(
        emailTemplate,
        language,
        {
          sender,
          receiver,
          company,
          notifications: [
            {
              type: event,
              item: e.item,
              urlComponents,
            },
          ],
        },
      );

      logger.info(`Sending email notification to ${receiver.email_canonical}`);
      await globalResolver.platformServices.emailPusher.send(receiver.email_canonical, {
        subject,
        html,
        text,
      });
    } catch (error) {
      logger.error(error);
    }
  }

  async init(): Promise<this> {
    const repository = await globalResolver.database.getRepository<DriveFile>(TYPE, DriveFile);

    globalResolver.platformServices.messageQueue.processor.addHandler(new DocumentsProcessor());
    globalResolver.platformServices.messageQueue.processor.addHandler(
      new DocumentsFinishedProcess(repository),
    );

    localEventBus.subscribe(DocumentEvents.DOCUMENT_SAHRED, async (e: NotificationPayloadType) => {
      await this.DispatchDocumentEvent(e, DocumentEvents.DOCUMENT_SAHRED);
    });

    localEventBus.subscribe(
      DocumentEvents.DOCUMENT_VERSION_UPDATED,
      async (e: NotificationPayloadType) => {
        await this.DispatchDocumentEvent(e, DocumentEvents.DOCUMENT_VERSION_UPDATED);
      },
    );

    localEventBus.subscribe(
      DocumentEvents.DOCUMENT_AV_SCAN_ALERT,
      async (e: NotificationPayloadType) => {
        await this.DispatchDocumentEvent(e, DocumentEvents.DOCUMENT_AV_SCAN_ALERT);
      },
    );

    return this;
  }

  notifyDocumentShared(notificationPayload: NotificationPayloadType) {
    localEventBus.publish(DocumentEvents.DOCUMENT_SAHRED, notificationPayload);
  }

  notifyDocumentVersionUpdated(notificationPayload: NotificationPayloadType) {
    localEventBus.publish(DocumentEvents.DOCUMENT_VERSION_UPDATED, notificationPayload);
  }

  notifyDocumentAVScanAlert(notificationPayload: NotificationPayloadType) {
    localEventBus.publish(DocumentEvents.DOCUMENT_AV_SCAN_ALERT, notificationPayload);
  }
}
