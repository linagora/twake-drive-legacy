const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const directry = path.join(__dirname, "./");
const tests = fs.readdirSync(directry).filter(path => fs.statSync(path).isDirectory());

tests.forEach(test => {
  console.log(`Running ${test}...`);
  execSync(`k6 run ./${test}/index.js`, { stdio: "inherit" });
});
