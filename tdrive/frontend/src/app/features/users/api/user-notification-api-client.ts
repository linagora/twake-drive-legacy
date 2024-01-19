import Api from '../../global/framework/api-service';
import { NotificationType } from '@features/users/types/notification-types';
import { TdriveService } from '../../global/framework/registry-decorator-service';

@TdriveService('UserNotificationAPIClientService')
class UserNotificationAPIClient {
  async getAllCompaniesBadges(): Promise<NotificationType[]> {
    const response = await Api.get<{ resources: NotificationType[] }>(
      '/internal/services/notifications/v1/badges?limit=1000&websockets=1&all_companies=true',
    );
    return response.resources ? response.resources : [];
  }

  async getCompanyBadges(companyId: string): Promise<NotificationType[]> {
    const response = await Api.get<{ resources: NotificationType[] }>(
      '/internal/services/notifications/v1/badges?limit=1000&websockets=1&company_id=' + companyId,
    );
    return response.resources ? response.resources : [];
  }

  async acknowledge(notification: NotificationType): Promise<void> {
    const { message_id, channel_id, company_id, thread_id, workspace_id } = notification;
    await Api.post<
      { message_id: string; thread_id: string; channel_id: string; workspace_id: string },
      boolean
    >(`/internal/services/notifications/v1/badges/${company_id}/acknowledge`, {
      channel_id,
      workspace_id,
      thread_id,
      message_id,
    });
  }
}

export default new UserNotificationAPIClient();
