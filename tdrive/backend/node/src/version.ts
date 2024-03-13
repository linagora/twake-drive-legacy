import config from "config";

export default {
  current: config.get<string>("general.version.current") || "1.0.1",
  minimal: {
    web: /* @MIN_VERSION_WEB */ "1.0.0",
    mobile: /* @MIN_VERSION_MOBILE */ "1.0.0",
  },
};
