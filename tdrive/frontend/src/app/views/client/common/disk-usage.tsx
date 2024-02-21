import { Base } from "@atoms/text";
import { formatBytesToInt } from "@features/drive/utils";
import Languages from "features/global/services/languages-service";
import { useUserQuota } from "@features/users/hooks/use-user-quota";
import RouterServices from "features/router/services/router-service";
import { useEffect, useState } from "react";
import FeatureTogglesService, { FeatureNames } from "@features/global/services/feature-toggles-service";
import { useDriveItem } from "features/drive/hooks/use-drive-item";


const DiskUsage = () => {
  const { viewId } = RouterServices.getStateFromRoute();
  console.log("VIEW-iD::" + viewId);

  const [used, setUsed] = useState(0);
  const [usedBytes, setUsedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);

  if (FeatureTogglesService.isActiveFeatureName(FeatureNames.COMPANY_USER_QUOTA)) {
    const { quota } = useUserQuota()
    useEffect(() => {
      setUsed(Math.round(quota.used / quota.total * 100))
      setUsedBytes(quota.used);
      setTotalBytes(quota.total);
    }, [quota]);
  } else if (viewId) {
    const { item } = useDriveItem(viewId);
    useEffect(() => {
      setUsedBytes(item?.size || 0);
    }, [viewId, item])
  }

  return (
    <>
      {FeatureTogglesService.isActiveFeatureName(FeatureNames.COMPANY_USER_QUOTA) && (
        <div className="bg-zinc-500 dark:bg-zinc-800 bg-opacity-10 rounded-md p-4 w-auto max-w-md">
          <div className="w-full">
            <div className="overflow-hidden h-4 mb-4 text-xs flex rounded bg-emerald-200">
              {used > 90 && (
              <div style={{  width: used +  '%',}} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-red-500"></div>
              )}
              {used < 80  && (
                <div style={{ width: used +  '%',}} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"></div>
              )}
              { (used >= 80  && used <= 90 )&& (
                <div style={{ width: used +  '%',}} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-yellow-500"></div>
              )}

              <div style={{ width: (100 - used) +  '%' }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-grey-500"></div>
            </div>
            {/*<div className="bg-blue-600 h-1.5 rounded-full dark:bg-blue-500" style={usedStyle}></div>*/}
            <Base>
              {formatBytesToInt(usedBytes)}
              <Base>  { Languages.t('components.disk_usage.of')} </Base>
              {formatBytesToInt(totalBytes || 0)}
              <Base> { Languages.t('components.disk_usage.used')} </Base>
              {/*<Base>{formatBytes(trash?.size || 0)} {Languages.t('components.disk_usage.in_trash')}</Base>*/}
            </Base>
          </div>
        </div>
      )}
      {!FeatureTogglesService.isActiveFeatureName(FeatureNames.COMPANY_USER_QUOTA) && (
        <div className="bg-zinc-500 dark:bg-zinc-800 bg-opacity-10 rounded-md p-4 w-auto max-w-md">
          <div className="w-full">
            <Base>
              {formatBytesToInt(usedBytes)}
              <Base>  { Languages.t('components.disk_usage.used')} </Base>
            </Base>
          </div>
        </div>
      )}
    </>
  );
};

export default DiskUsage;