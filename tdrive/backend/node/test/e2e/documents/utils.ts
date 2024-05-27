import { DriveFile } from "../../../src/services/documents/entities/drive-file";
import { FileVersion } from "../../../src/services/documents/entities/file-version";
import { TestPlatform } from "../setup";
import formAutoContent from "form-auto-content";
import * as fs from "fs";

const url = "/internal/services/documents/v1";

export const e2e_updateDocument = async (
  platform: TestPlatform,
  id: string | "root" | "trash",
  item: Partial<DriveFile>,
) => {
  const token = await platform.auth.getJWTToken();

  return await platform.app.inject({
    method: "POST",
    url: `${url}/companies/${platform.workspace.company_id}/item/${id}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: item,
  });
};

export const e2e_createVersion = async (
  platform: TestPlatform,
  id: string,
  payload: Partial<FileVersion>,
  jwt?: string,
) => {
  const token = jwt ?? (await platform.auth.getJWTToken());

  return await platform.app.inject({
    method: "POST",
    url: `${url}/companies/${platform.workspace.company_id}/item/${id}/version`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload,
  });
};

export const e2e_createDocumentFile = async (platform: TestPlatform, documentPath?: string) => {
  const subFilePath = documentPath ?? "assets/test.txt";
  const filePath = `${__dirname}/${subFilePath}`;
  const token = await platform.auth.getJWTToken();
  const form = formAutoContent({ file: fs.createReadStream(filePath) });
  form.headers["authorization"] = `Bearer ${token}`;

  return await platform.app.inject({
    method: "POST",
    url: `/internal/services/files/v1/companies/${platform.workspace.company_id}/files`,
    ...form,
  });
};
