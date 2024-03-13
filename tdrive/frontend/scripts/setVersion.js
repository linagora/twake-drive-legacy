const fs = require('fs');

const targetPath = `${__dirname}/../src/app/environment/version.ts`;
const appVersion = process.env.TWAKE_DRIVE_VERSION || '1.0.0';

const updatedData = `export default {
  version: /* @VERSION */ '${appVersion}',
  version_detail: /* @VERSION_DISPLAY_NAME */ '${appVersion}',
  version_name: /* @VERSION_NAME */ 'Ghost-Dog',
};`;
fs.writeFile(targetPath, updatedData,(err) => {
  if (err) {
    console.error(`Error writing file: ${targetPath}`, err);
    process.exit(1);
  }
  console.log(`Version set to: ${appVersion}`);
});
