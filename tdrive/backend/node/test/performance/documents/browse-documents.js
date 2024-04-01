import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

// Custom metric to track document creation duration
let docBrowseDuration = new Trend("doc_browse_duration");

export let options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 20 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    doc_browse_duration: ["p(95)<500"], // 95% of browse operatins should be faster than 500ms
  },
};

const baseURL = `${__ENV.BACKEND}/internal/services/documents/v1/companies`;

function browseDocuments(JWT, companyID) {
  const url = `${baseURL}/${companyID}/browse/root`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${JWT}`,
  };
  const body = {
    company_id: companyID,
    mime_type: "",
  };
  let creationStartTime = new Date().getTime();
  const response = http.post(url, JSON.stringify(body), { headers });
  let creationEndTime = new Date().getTime();

  docBrowseDuration.add(creationEndTime - creationStartTime);

  return JSON.parse(response.body);
}

export default function () {
  const JWT = __ENV.JWT; // JWT set as an environment variable
  const companyID = __ENV.COMPANY_ID; // Company ID set as an environment variable

  const responseBody = browseDocuments(JWT, companyID);
  check(responseBody, {
    "response is successful": body => body.path[0].id == "root",
  });

  sleep(1);
}
