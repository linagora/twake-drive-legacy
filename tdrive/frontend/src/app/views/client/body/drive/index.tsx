import { useCompanyApplications } from 'app/features/applications/hooks/use-company-applications';
import Browser from './browser';
import { SelectorModal } from './modals/selector';

export type EmbedContext = {
  companyId?: string;
  workspaceId?: string;
  channelId?: string;
  tabId?: string;
};

export default ({
  initialParentId,
  inPublicSharing,
}: {
  initialParentId?: string;
  context?: EmbedContext;
  inPublicSharing?: boolean;
}) => {
  return (
    <>
      <SelectorModal />
      <Browser initialParentId={initialParentId} inPublicSharing={inPublicSharing} />
    </>
  );
};
