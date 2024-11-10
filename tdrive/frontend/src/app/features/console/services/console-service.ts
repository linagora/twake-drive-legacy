/* eslint-disable @typescript-eslint/no-explicit-any */
import Api from '@features/global/framework/api-service';
import InitService from '@features/global/services/init-service';
import Languages from '@features/global/services/languages-service';
import { ToasterService as Toaster } from '@features/global/services/toaster-service';
import { ConsoleMemberRole } from '@features/console/types/types';
import Logger from '@features/global/framework/logger-service';

class ConsoleService {
  logger: Logger.Logger;
  constructor() {
    this.logger = Logger.getLogger('Console');
  }

  public getCompanyManagementUrl(companyId: string) {
    return InitService.getConsoleLink('company_management_url', companyId);
  }

  public getCompanySubscriptionUrl(companyId: string) {
    return InitService.getConsoleLink('company_subscription_url', companyId);
  }

  public getCompanyUsersManagementUrl(companyId: string) {
    return InitService.getConsoleLink('collaborators_management_url', companyId);
  }

  public verifyMail() {
    return new Promise(async resolve => {
      const response = await Api.post(
        '/internal/services/console/v1/resend-verification-email',
        {},
        (res: { data: { error: string; message: string; statusCode: number } }) => {
          if (res.data === null)
            return Toaster.success(
              Languages.t('services.console_services.toaster.success_verify_email'),
            );
          else return Toaster.error(res.data.message);
        },
      );

      return resolve(response);
    });
  }

  public async addMailsInWorkspace(data: {
    workspace_id: string;
    company_id: string;
    emails: string[];
    workspace_role?: 'moderator' | 'member';
    company_role?: ConsoleMemberRole;
  }) {
    const res: any = await Api.post(
      `/internal/services/workspaces/v1/companies/${data.company_id}/workspaces/${data.workspace_id}/users/invite`,
      {
        invitations: [
          ...data.emails.map(email => ({
            email,
            role: data.workspace_role || 'member',
            company_role: data.company_role || 'member',
          })),
        ],
      },
    );

    if (!res?.resources || !res.resources.length) {
      this.logger.error('Error while adding emails');
      return Toaster.error(Languages.t('services.console_services.toaster.add_emails_error'));
    }

    if (res.resources.filter((r: any) => r.status === 'error').length > 0) {
      if (
        res.resources.filter((r: any) => r.message.includes('403') && r.status === 'error').length >
        0
      ) {
        Toaster.warning('You have not the corresponding access rights to invite to this company.');
      } else {
        res.resources
          .filter((r: any) => r.status === 'error')
          .forEach(({ email, message }: { email: string; message: string }) => {
            // possible error messages are
            // 1. "User already belonged to the company" (Good typo in it...)
            // 2. "Unable to invite user ${user.email} to company ${company.code}"
            this.logger.error('Error while adding email', email, message);

            Toaster.warning(
              Languages.t('services.console_services.toaster.add_email_error_message', [
                email + ` (${message})`,
              ]),
            );
          });
      }
    }

    if (res.resources.filter((r: any) => r.status !== 'error').length > 0) {
      Toaster.success(
        Languages.t('services.console_services.toaster.success_invite_emails', [
          res.resources.filter((r: any) => r.status !== 'error').length,
        ]),
      );
    }

    return res;
  }

}

export default new ConsoleService();
