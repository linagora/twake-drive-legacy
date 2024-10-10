// @ts-ignore
import path from "path";
// @ts-ignore
import config from "config";

const ourConfigDir = path.join(__dirname, 'oneof-storage');
let configs = config.util.loadFileConfigs(ourConfigDir);
config.util.extendDeep(config, configs);
