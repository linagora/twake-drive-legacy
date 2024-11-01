import { fromPath } from "pdf2pic";
import { mkdirSync } from "fs";
import { cleanFiles, getTmpFile } from "../../../../../utils/files";
import { logger } from "../../../../../core/platform/framework";

class PDFConversionError extends Error {}

export async function convertFromPdf(
  inputPath: string,
  options: {
    numberOfPages: number;
  },
): Promise<{ output: string[]; done: boolean }> {
  const pages: string[] = [];

  try {
    const pdfOptions = {
      density: 100,
      saveFilename: "output",
      savePath: getTmpFile(),
      format: "png",
    };
    mkdirSync(pdfOptions.savePath, { recursive: true });
    const storeAsImage = fromPath(inputPath, pdfOptions);
    try {
      for (let i = 1; i <= options.numberOfPages; i++) {
        const image = await storeAsImage(i);
        pages.push(
          `${pdfOptions.savePath}/${pdfOptions.saveFilename}.${image.page}.${pdfOptions.format}`,
        );
      }
    } catch (err) {
      if (!pages.length) {
        throw err;
      }
      //Just no more page to convert
    }
  } catch (error) {
    const pdfConversionError = new PDFConversionError("Can't convert file with pdf-image.", { cause: error });
    logger.error(pdfConversionError);
    for (const file of pages) {
      cleanFiles([file]);
    }
    throw pdfConversionError;
  }
  return { output: pages, done: true };
}
