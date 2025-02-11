import http from "k6/http";
import { check, sleep } from "k6";
import { FormData } from "https://jslib.k6.io/formdata/0.0.2/index.js";
import { Trend } from "k6/metrics";

//============== init block of the whole test ==============

// Custom metric to track upload duration
let uploadDuration = new Trend("upload_duration");

export let options = {
  stages: [
    { duration: "30s", target: 2 },
    { duration: "3m", target: 2 },
    { duration: "3m", target: 1 },
  ],
  thresholds: {
    upload_duration: ["p(95)<10000"], // 95% of uploads should be faster than 1500ms
  },
};

const binFile = open("../assests/sample.pdf", 'b');
const baseURL = `${__ENV.BACKEND}/internal/services/files/v1/companies`;
const JWT = __ENV.JWT; // Set JWT as an environment variable
const companyID = __ENV.COMPANY_ID; // Set Company ID as an environment variable


//============== init VUs with test data ==============
export function setup() {
  const data = {};

  //get user info
  data.user = get(`${__ENV.BACKEND}/internal/services/users/v1/users/me`).resource
  console.log(`Start VU with user: ${JSON.stringify(data.user)}`);

  //create root folder to upload all files
  const url = `${__ENV.BACKEND}/internal/services/documents/v1/companies/${companyID}/item`
  const payload = {
    item:{
      name: "PerfTests",
      parent_id: "user_" + data.user.id,
      is_directory: true,
      company_id: "00000000-0000-4000-0000-000000000000"
    },
    version: {}
  };
  data.rootFolder = post(url, payload);
  console.log(`Created root folder for performance tests: ${JSON.stringify(data.rootFolder)}`);
  return data;
}

export default function (data) {
  const responseBody = uploadFile(binFile, "application/pdf");
  check(responseBody, {
    "response is successful": body => body.resource !== undefined,
    "company_id is present": body => body.resource.company_id !== undefined,
  });

  const file = responseBody.resource;

  const item = {
    name: file.metadata.name,
    parent_id: data.rootFolder.id,
    company_id: file.company_id,
  };

  const version = {
    file_metadata: {
      name: file.metadata.name,
      size: file.upload_data?.size,
      thumbnails: [],
      external_id: file.id,
    },
  };

  const response = post(
    `${__ENV.BACKEND}/internal/services/documents/v1/companies/${companyID}/item`,
    {
      item,
      version,
    }
  );

  check(response, {
    "response is successful": body => body !== undefined,
  });

  sleep(1);
}

export function teardown(data) {
  deleteMe(`${__ENV.BACKEND}/internal/services/documents/v1/companies/${companyID}/item/${data.rootFolder.id}`)
  deleteMe(`${__ENV.BACKEND}/internal/services/documents/v1/companies/${companyID}/item/${data.rootFolder.id}`)
}



function post(url, payload) {
  const headers = {
    Authorization: `Bearer ${JWT}`,
    "Content-Type": "application/json",
  };
  console.debug(`POST BODY: ${JSON.stringify(payload)}`);
  const response = http.post(url, JSON.stringify(payload), { headers })
  console.debug(`POST RESPONSE: ${JSON.stringify(response)}`);
  return JSON.parse(response.body)
}

function get(url) {
  const headers = {
    Authorization: `Bearer ${JWT}`,
    "Content-Type": "application/json",
  };
  const response = http.get(url, { headers })
  return JSON.parse(response.body)
}

function deleteMe(url) {
  const headers = {
    Authorization: `Bearer ${JWT}`,
  };
  const response = http.del(url, {}, { headers })
  console.debug(`DELETE RESPONSE: ${JSON.stringify(response)}`);
  check(response, {
    "DELETE response is successful": response => response.status === 200,
  });
  return response
}

function uploadFile(filePath, fileType) {
  const url = `${baseURL}/${companyID}/files?thumbnail_sync=0`;
  const formData = new FormData();
  const randomInt = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  const fileName = `${randomInt.toString(36)}.${fileType.split("/")[1]}`; // Extract extension from MIME type
  formData.append("file", http.file(filePath, fileName, fileType));

  const headers = {
    Authorization: `Bearer ${JWT}`,
    "Content-Type": `multipart/form-data; boundary=${formData.boundary}`,
  };

  let uploadStartTime = new Date().getTime();
  const response = http.post(url, formData.body(), { headers });
  let uploadEndTime = new Date().getTime();
  console.debug(`POST RESPONSE: ${JSON.stringify(response)}`);

  uploadDuration.add(uploadEndTime - uploadStartTime);
  return JSON.parse(response.body);
}
