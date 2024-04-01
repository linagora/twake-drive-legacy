import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

// Custom metric to track document creation duration
let docCreationDuration = new Trend("doc_creation_duration");

export let options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 20 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    doc_creation_duration: ["p(95)<500"], // 95% of document creations should be faster than 500ms
  },
};

const baseURL = `${__ENV.BACKEND}/internal/services/files/v1/companies`;

function createDocument(JWT, companyID, item, version) {
  const url = `${baseURL}/${companyID}/item`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${JWT}`,
  };

  let creationStartTime = new Date().getTime();
  const response = http.post(url, JSON.stringify({ item, version }), { headers });
  let creationEndTime = new Date().getTime();

  docCreationDuration.add(creationEndTime - creationStartTime);

  return JSON.parse(response.body);
}

export default function () {
  const JWT = __ENV.JWT; // JWT set as an environment variable
  const companyID = __ENV.COMPANY_ID; // Company ID set as an environment variable

  // Example item and version, modify as needed
  const scope = "shared";
  const randomInt = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  const fileName = `${randomInt.toString(36)}`;
  const item = {
    name: fileName,
    parent_id: "root",
    company_id: companyID,
    scope,
  };
  const version = {};

  const responseBody = createDocument(JWT, companyID, item, version);

  check(responseBody, {
    "response is successful": body => body.resource !== undefined,
    "company_id is present": body => body.resource.company_id !== undefined,
  });

  sleep(1);
}
