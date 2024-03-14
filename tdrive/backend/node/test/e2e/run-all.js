/**
 * To run all tests in local development mode:
 * cd tdrive/; docker-compose -f docker-compose.dev.tests.mongo.yml run -e NODE_OPTIONS=--unhandled-rejections=warn -e SEARCH_DRIVER=mongodb -e DB_DRIVER=mongodb -e PUBSUB_TYPE=local node npm run test:e2e
 *
 * To run only specific tests:
 * cd tdrive/; docker-compose -f docker-compose.dev.tests.mongo.yml run -e NODE_OPTIONS=--unhandled-rejections=warn -e SEARCH_DRIVER=mongodb -e DB_DRIVER=mongodb -e PUBSUB_TYPE=local node npm run test:e2e -- test/e2e/application/app-create-update.spec.ts  test/e2e/application/application-events.spec.ts
 */

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

let localDevTests = process.argv.slice(2);

//If we are in the CI tests we will run all the tests
if (process.env.CI || localDevTests.length === 0) {
  localDevTests = false;
}

if (localDevTests) {
  console.log("Only this tests will be run:", localDevTests);
} else {
  console.log("Will run all the tests.");
}

function exec(command, args, debug = false) {
  return new Promise(done => {
    const cmd = cp.spawn(command, args, {
      shell: true,
    });

    let data = "";
    let error = "";

    cmd.stdout.on("data", function (data) {
      if (debug) console.log(data.toString());
      data += data.toString() + "\n";
    });

    cmd.stderr.on("data", function (data) {
      if (debug) console.log(data.toString());
      error += data.toString() + "\n";
    });

    cmd.on("exit", function (code) {
      cmd.kill(9);

      //The delay is to make sure we get all the missing logs
      setTimeout(() => done({ code, data, error }), code === 0 ? 1 : 5000);
    });
  });
}

let srcFiles = [];
let srcPath = __dirname;
function throughDirectory(directory) {
  fs.readdirSync(directory).forEach(file => {
    const abs = path.join(directory, file);
    if (fs.statSync(abs).isDirectory()) return throughDirectory(abs);
    else return srcFiles.push(abs);
  });
}
throughDirectory(srcPath);

srcFiles = srcFiles.filter(p => p.indexOf(".spec.ts") >= 0 || p.indexOf(".test.ts") >= 0);

(async () => {
  let failed = 0;
  let passed = 0;

  let summary = "";

  for (const path of localDevTests || srcFiles) {
    const test = path.split("test/e2e/")[1];
    // skip the test if it's quota a quota test, it will be run separately
    if (test.includes("quota")) {
      console.log(`Skipping ${test}`);
      continue;
    }
    const testName = `test/e2e/${test}`;
    const args = `${testName} --forceExit --detectOpenHandles --coverage --coverageDirectory=coverage/e2e/${test} --runInBand --testTimeout=60000 --verbose=true`;

    try {
      //Show logs in the console if we are doing local dev tests
      const out = await exec("jest", args.split(" "), !!localDevTests);
      if (out.code !== 0) {
        //To get all the logs, we run it again
        console.log(`FAIL ${testName}`);
        console.log(out.data);
        console.log(out.error);
        if (!localDevTests) await exec("jest", args.split(" "), true);
        failed++;
        summary += `FAIL ${testName}\n`;
      } else {
        passed++;
        console.log(`PASS ${testName}`);
      }
    } catch (err) {
      console.log(`ERROR ${testName}`);
      console.log(`-- Error\n ${err}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed, total ${failed + passed}`);
  console.log(summary);

  process.exit(failed > 0 ? 1 : 0);
})();
