// @ts-ignore
import path from "path";
// @ts-ignore
import config from "config";

// @ts-ignore
const ourConfigDir = path.join(__dirname, 'documents-av');
let configs = config.util.loadFileConfigs(ourConfigDir);
config.util.extendDeep(config, configs);