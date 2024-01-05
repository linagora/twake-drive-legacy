const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const directory = path.join(__dirname, "./");
const tests = fs.readdirSync(directory).filter(filePath => fs.statSync(filePath).isDirectory());

tests.forEach(test => {
  const testDirectory = path.join(directory, test);
  const files = fs.readdirSync(testDirectory).filter(file => file.endsWith(".js"));

  files.forEach(file => {
    console.log(`Running ${test}/${file}...`);
    execSync(`k6 run ./${test}/${file}`, { stdio: "inherit" });
  });
});
