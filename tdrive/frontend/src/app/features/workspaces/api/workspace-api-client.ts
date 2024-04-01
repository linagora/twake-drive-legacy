import Api from '../../global/framework/api-service';
import { CompanyType } from '@features/companies/types/company';
import { WorkspaceType } from '@features/workspaces/types/workspace';
import { TdriveService } from '../../global/framework/registry-decorator-service';
import _ from 'lodash';

const PREFIX = '/internal/services/workspaces/v1/companies';

export type WorkspaceUpdateResource = Partial<WorkspaceType & { logo_b64?: string }>;

export type UpdateWorkspaceBody = {
  resource: WorkspaceUpdateResource;
};

export type UpdateWorkspaceInviteDomainBody = {
  domain: string;
};

type UpdateWorkspaceInviteDomainResponse = {
  status: string;
};

@TdriveService('WorkspaceAPIClientService')
class WorkspaceAPIClient {
  /**
   * Get all workspaces for a company
   *
   * @param companyId
   */
  async list(companyId: string): Promise<WorkspaceType[]> {
    return Api.get<{ resources: WorkspaceType[] }>(
      `${PREFIX}/${companyId}/workspaces?websockets=1`,
    ).then(result => {
      return result.resources && result.resources.length ? result.resources : [];
    });
  }

  /**
   * Get a workspace
   *
   * @param companyId
   * @param workspaceId
   * @returns
   */
  async get(companyId: string, workspaceId: string): Promise<WorkspaceType> {
    return Api.get<{ resource: WorkspaceType }>(
      `${PREFIX}/${companyId}/workspaces/${workspaceId}`,
    ).then(result => result.resource);
  }

  /**
   * Create a workspace
   *
   * @param companyId
   * @param workspace
   * @returns the updated workspace
   */
  async create(companyId: string, workspace: WorkspaceUpdateResource): Promise<WorkspaceType> {
    return Api.post<UpdateWorkspaceBody, { resource: WorkspaceType }>(
      `${PREFIX}/${companyId}/workspaces`,
      { resource: workspace },
    ).then(result => result.resource);
  }

  /**
   * Delete a workspace
   *
   * @param companyId
   * @param workspace
   * @returns the updated workspace
   */
  async delete(companyId: string, workspaceId: string): Promise<WorkspaceType> {
    return Api.delete<{ resource: WorkspaceType }>(
      `${PREFIX}/${companyId}/workspaces/${workspaceId}`,
    ).then(result => result.resource);
  }

  /**
   * Update a given workspace
   *
   * @param companyId
   * @param workspaceId
   * @param workspace
   * @returns the updated workspace
   */
  update(
    companyId: string,
    workspaceId: string,
    workspace: WorkspaceUpdateResource,
  ): Promise<WorkspaceType> {
    return Api.post<
      UpdateWorkspaceBody & { options?: { logo_b64?: string } },
      { resource: WorkspaceType }
    >(`${PREFIX}/${companyId}/workspaces/${workspaceId}`, {
      resource: _.omit(workspace, 'logo_b64'),
      options: { logo_b64: workspace?.logo_b64 },
    }).then(result => result.resource);
  }

  /**
   * Get companies for a given user
   *
   * @param userId
   * @returns
   */
  async listCompanies(userId: string): Promise<CompanyType[]> {
    return Api.get<{ resources: CompanyType[] }>(
      `/internal/services/users/v1/users/${userId}/companies`,
    ).then(result => result.resources);
  }

  setInvitationDomain = async (
    companyId: string,
    workspaceId: string,
    domain: string,
  ): Promise<void> => {
    const response = await Api.post<
      UpdateWorkspaceInviteDomainBody,
      UpdateWorkspaceInviteDomainResponse
    >(`${PREFIX}/${companyId}/workspaces/${workspaceId}/invite_domain`, { domain });

    if (response.status !== 'success') {
      throw Error('failed to set invitation domain');
    }
  };
}

export default new WorkspaceAPIClient();
