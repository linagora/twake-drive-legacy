import { mkdirSync, existsSync, promises as fsPromise, createWriteStream, readFileSync } from "fs";
import { Readable } from "stream";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../core/platform/framework";

const { unlink } = fsPromise;

/**
 * Generates a random temporary file path
 *
 * @param {string} suffix - the file extension.
 * @returns {string} - the temporary file.
 */
export const getTmpFile = (suffix: string = ""): string => {
  const targetDir = "/tmp/";
  mkdirSync(targetDir, { recursive: true });
  return `${targetDir}${uuidv4()}${suffix}`;
};

/**
 * Removes files from disk
 *
 * @param {string[]} paths - the paths to be deleted.
 */
export const cleanFiles = async (paths: string[]): Promise<void> => {
  for (const path of paths) {
    if (existsSync(path)) await unlink(path);
  }
};

/**
 * Writes a File stream into a temporary file path
 *
 * @param {Readable} input - the input stream.
 * @param {string} extension - the file extension.
 * @returns {Promise<string>} - the generated file.
 */
export const writeToTemporaryFile = async (input: Readable, extension: string): Promise<string> => {
  try {
    const temporaryFilePath = getTmpFile(`.${extension}`);

    const writable = createWriteStream(temporaryFilePath);

    input.pipe(writable);

    await new Promise(r => {
      writable.on("finish", r);
    });

    writable.end();

    return temporaryFilePath;
  } catch (error) {
    logger.debug(error);

    throw Error(error);
  }
};

/**
 * Reads a file from the disk
 *
 * @returns {Promise<Buffer>} - the file readable stream.
 */
export const readFromTemporaryFile = async (path: string): Promise<Buffer> => {
  return readFileSync(path);
};

/**
 * Converts a readable stream into a Buffer.
 *
 * @param {Readable} input - the input stream.
 * @returns {Promise<Buffer>}
 */
export const readableToBuffer = async (input: Readable): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const buffer: Uint8Array[] = [];

    input.on("data", chunk => buffer.push(chunk));
    input.on("end", () => resolve(Buffer.concat(buffer)));
    input.on("error", err => reject(err));
  });
};

/**
 * Converts a file readable stream to string
 *
 * @param {Readable} readable - the file stream
 * @returns {Promise<string>}
 */
export const readableToString = async (readable: Readable): Promise<string> => {
  let content = "";

  return new Promise((resolve, reject) => {
    readable.on("data", data => {
      content += data.toString();
    });

    readable.on("end", () => {
      resolve(content);
    });

    readable.on("error", error => {
      reject(error);
    });
  });
};
