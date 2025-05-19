/* eslint-disable prettier/prettier */
import axios from "axios";
import config from "config";

export const DEFAULT_COMPANY = config.get<string>("drive.defaultCompany");
export const COZY_DOMAIN = config.get<string>("migration.cozyDomain");
const COZY_OFFER = config.get<string>("migration.cozyOffer");
const COZY_MANAGER_URL = config.get<string>("migration.cozyManagerUrl");
const COZY_MANAGER_TOKEN = config.get<string>("migration.cozyManagerToken");
const POLL_INTERVAL_MS = config.get<number>("migration.pollInterval");
const MAX_RETRIES = config.get<number>("migration.maxRetries");

function buildUploadUrl(baseUrl, params) {
  const searchParams = new URLSearchParams(params);
  return `${baseUrl}?${searchParams.toString()}`;
}

export function nodeReadableToWebReadable(readable, onProgress?: (chunkSize: number) => void) {
  const reader = readable[Symbol.asyncIterator]();
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.next();
      if (done) {
        controller.close();
      } else {
        if (onProgress) onProgress(value.length); // report progress
        controller.enqueue(value);
      }
    },
    cancel() {
      reader.return?.();
    },
  });
}

export async function createCozyInstance(user: {
  id: string;
  email: string;
  name: string;
  _id: string;
}) {
  console.log(`🚀 Creating Cozy instance for ${user.email}...`);

  try {
    // Step 1: Create the instance
    const { data: createInstanceData } = await axios.post(
      `${COZY_MANAGER_URL}/instances`,
      {
        offer: COZY_OFFER,
        slug: user.id,
        domain: COZY_DOMAIN,
        email: user.email,
        public_name: user.name,
        locale: "fr",
        oidc: user.id,
      },
      {
        headers: {
          Authorization: `Bearer ${COZY_MANAGER_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    const workflowId = createInstanceData.workflow;
    console.log(`✅ Created instance for ${user.email}, workflow ID: ${workflowId}`);

    // Step 2: Check workflow status
    const checkWorkflowStatus = async () => {
      const { data } = await axios.get(`${COZY_MANAGER_URL}/workflows/${workflowId}`, {
        headers: {
          Authorization: `Bearer ${COZY_MANAGER_TOKEN}`,
          "Content-Type": "application/json",
        },
      });
      return data.status;
    };

    let attempt = 0;
    let finished = false;

    while (attempt < MAX_RETRIES && !finished) {
      attempt++;
      console.log(
        `🔄 Checking workflow status for ${user.email} (attempt ${attempt}/${MAX_RETRIES})...`,
      );

      const status = await checkWorkflowStatus();

      if (status === "finished") {
        console.log(`🎉 Workflow finished for ${user.email}`);
        finished = true;
      } else {
        console.log(
          `⏳ Workflow not finished yet for ${user.email}, waiting ${POLL_INTERVAL_MS / 1000}s...`,
        );
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    if (!finished) {
      console.warn(
        `⚠️ Workflow for ${user.email} did not finish after ${MAX_RETRIES} tries. Moving on.`,
      );
    }
  } catch (error: any) {
    if (error.response) {
      console.error(
        `❌ Error migrating ${user.email}:`,
        error.response.status,
        error.response.data,
      );
    } else {
      console.error(`❌ Error migrating ${user.email}:`, error.message);
    }
    throw error;
  }
}

export async function getDriveToken(slugDomain: string): Promise<{ token: string }> {
  const url = `${COZY_MANAGER_URL}/instances/${slugDomain}/drive_token`;

  try {
    const response = await axios.post(url, null, {
      headers: {
        Authorization: `Bearer ${COZY_MANAGER_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    return response.data; // Should be { token: "..." }
  } catch (error: any) {
    console.error(
      `Failed to get drive token for ${slugDomain}`,
      error.response?.data || error.message,
      url,
    );
    throw new Error(`Could not retrieve drive token for ${slugDomain}`);
  }
}

export async function uploadFile(
  fileName: string,
  userId: string,
  fileDirPath: string,
  userToken: string,
  fileReadable: ReadableStream<any>,
) {
  const baseUrl = `https://${userId}.${COZY_DOMAIN}/files/${fileDirPath}`;
  const params = {
    Name: fileName,
    Type: "file",
    Executable: false,
    Encrypted: false,
    Size: "",
  };
  const uploadUrl = buildUploadUrl(baseUrl, params);
  const resp = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken}`,
      "Content-Type": "application/octet-stream",
    },
    duplex: "half",
    body: fileReadable,
  } as RequestInit);
  return resp;
}
