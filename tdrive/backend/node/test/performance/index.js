const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http"); // or 'https' if your URL is https

const COMPANY_ID = "COMPANY_ID";
const JWT = "JWT";
const BASE_URL = "https://tdrive.qa.lin-saas.com";
const shouldDownload = process.argv.includes("--download");

const directory = path.join(__dirname, "./");
const tests = fs.readdirSync(directory).filter(filePath => fs.statSync(filePath).isDirectory());

// Ensure the assets folder exists
const assetsDirectory = path.join(__dirname, "assets");
if (!fs.existsSync(assetsDirectory)) {
  fs.mkdirSync(assetsDirectory);
}

// Array of item IDs with corresponding file formats
const items = [
  { id: "751416c3-e486-4e2e-8ad6-f6155e4c7c4b", format: "pdf" },
  { id: "another-item-id", format: "png" },
  { id: "yet-another-item-id", format: "jpg" },
  // Add more items and formats as needed
];

// Function to download the file
const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    http
      .get(url, response => {
        response.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", err => {
        fs.unlink(dest);
        reject(err.message);
      });
  });
};

// Function to run the tests
const runTests = () => {
  tests.forEach(test => {
    const testDirectory = path.join(directory, test);
    const files = fs.readdirSync(testDirectory).filter(file => file.endsWith(".js"));

    files.forEach(file => {
      console.log(`Running ${test}/${file}...`);
      execSync(
        `k6 run -e BACKEND=${BASE_URL} -e COMPANY_ID=${COMPANY_ID} -e JWT=${JWT} ./${test}/${file}`,
        {
          stdio: "inherit",
        },
      );
    });
  });
};

// Function to download all files
const downloadAllFiles = async () => {
  for (const item of items) {
    const fileUrl = `${BASE_URL}/internal/services/documents/v1/companies/${COMPANY_ID}/item/${item.id}/download`;
    const localFilePath = path.join(assetsDirectory, `sample.${item.format}`);

    try {
      await downloadFile(fileUrl, localFilePath);
      console.log(`File sample.${item.format} downloaded successfully.`);
    } catch (err) {
      console.error(`Error downloading file sample.${item.format}:`, err);
    }
  }
};

// Main logic
if (shouldDownload) {
  downloadAllFiles().then(runTests);
} else {
  runTests();
}
