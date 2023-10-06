/**
 * This file replace version in code
 */

const versions = {
  VERSION_NAME: process.env.Tdrive_VERSION_NAME || "Albatros",
  VERSION: process.env.Tdrive_VERSION || "2023.Q1",
  VERSION_DETAIL: process.env.Tdrive_VERSION_DETAIL || "2023.Q1.1223",
  MIN_VERSION_WEB: process.env.Tdrive_MIN_VERSION_WEB || "2022.Q2.975",
  MIN_VERSION_MOBILE: process.env.Tdrive_MIN_VERSION_MOBILE || "2022.Q2.975",
};

const files = [
  "frontend/src/app/environment/version.ts",
  "backend/node/src/version.ts",
  "../.github/workflows/publish-backend.yml",
  "../.github/workflows/publish-frontend.yml",
];

var fs = require("fs");

files.forEach((file) => {
  fs.readFile(file, "utf8", function (err, data) {
    if (err) {
      return console.log(err);
    }

    var result = data;

    Object.keys(versions).forEach((k) => {
      const replacement = versions[k];
      result = result.replace(
        new RegExp("( @" + k + " .*')[a-zA-Z0-9.]*(')", "g"),
        "$1" + replacement + "$2"
      );
      result = result.replace(
        new RegExp("( @" + k + ' .*")[a-zA-Z0-9.]*(")', "g"),
        "$1" + replacement + "$2"
      );
    });

    result = result.replace(
      new RegExp('(DOCKERTAGVERSION=)[a-zA-Z0-9.]*(")', "g"),
      "$1" + versions.VERSION_DETAIL + "$2"
    );

    fs.writeFile(file, result, "utf8", function (err) {
      if (err) return console.log(err);
    });
  });
});
