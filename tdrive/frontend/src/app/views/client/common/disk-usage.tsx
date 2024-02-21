import { Base, Title } from "@atoms/text";
import { formatBytesToInt } from "@features/drive/utils";
import Languages from "features/global/services/languages-service";
import { useUserQuota } from "@features/users/hooks/use-user-quota";
import RouterServices from "features/router/services/router-service";
import { useEffect, useState } from "react";
import FeatureTogglesService, { FeatureNames } from "@features/global/services/feature-toggles-service";


export default () => {
  const { viewId } = RouterServices.getStateFromRoute();
  console.log("VIEW-iD::" + viewId);

  const { quota, used } = useUserQuota()
  // const [used, setUsed] = useState(
  //   Math.round(quota.used / quota.total * 100)
  // )
  //
  // useEffect(() => {
  //   console.log("SETUSED::")
  //   setUsed(Math.round(quota.used / quota.total * 100))
  // }, [quota]);
  //
  // useEffect(() => {
  //   console.log("USED::" + used);
  // }, [used]);

  return (
    <>
      <Title>{used}</Title>
      {!FeatureTogglesService.isActiveFeatureName(FeatureNames.COMPANY_USER_QUOTA) && (
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
              {formatBytesToInt(quota?.used || 0)}
              <Base>  { Languages.t('components.disk_usage.of')} </Base>
              {formatBytesToInt(quota?.total || 0)}
              <Base> { Languages.t('components.disk_usage.used')} </Base>
              {/*<Base>{formatBytes(trash?.size || 0)} {Languages.t('components.disk_usage.in_trash')}</Base>*/}
            </Base>
          </div>
        </div>
      )}
      {FeatureTogglesService.isActiveFeatureName(FeatureNames.COMPANY_USER_QUOTA) && (
        <div className="bg-zinc-500 dark:bg-zinc-800 bg-opacity-10 rounded-md p-4 w-auto max-w-md">
          <div className="w-full">
            <Base>
              {formatBytesToInt(quota?.used || 0)}
              <Base>  { Languages.t('components.disk_usage.used')} </Base>
            </Base>
          </div>
        </div>
      )}
    </>
  );
};