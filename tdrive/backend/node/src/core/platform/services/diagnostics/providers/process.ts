import diagnostics from "../../../framework/api/diagnostics";

export const e2eTestOverride = {
  // Set to true to force fail to test diagnostic aggregation
  forceFail: false,
};

export default () =>
  diagnostics.registerProviders({
    key: "process",
    tags: ["live", "ready", "stats"],
    async get() {
      return {
        ok: !e2eTestOverride.forceFail,
        gc: !!global.gc,
        pid: process.pid,
        mem: process.memoryUsage(),
        res: process.resourceUsage(),
      };
    },
  });
