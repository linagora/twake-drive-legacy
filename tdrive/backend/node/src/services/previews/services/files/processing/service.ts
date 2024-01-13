import { generatePreview as thumbnailsFromImages } from "./image";
import { convertFromPdf } from "./pdf";
import { isFileType } from "../../../utils";
import {
  imageExtensions,
  officeExtensions,
  pdfExtensions,
  videoExtensions,
} from "../../../../../utils/mime";
import { PreviewMessageQueueRequest, ThumbnailResult } from "../../../types";
import { generateVideoPreview } from "./video";
import { Initializable, logger, TdriveServiceProvider } from "../../../../../core/platform/framework";
import { cleanFiles } from "../../../../../utils/files";

export class PreviewProcessService implements TdriveServiceProvider, Initializable {
  name: "PreviewProcessService";
  version: "1";

  async init(): Promise<this> {
    return this;
  }

  async generateThumbnails(
    document: Pick<PreviewMessageQueueRequest["document"], "filename" | "mime" | "path">,
    options: PreviewMessageQueueRequest["output"],
  ): Promise<ThumbnailResult[]> {
    if (isFileType(document.mime, document.filename, officeExtensions)) {
      logger.info("Preview generation for office files currently not supported");
    }

    if (isFileType(document.mime, document.filename, pdfExtensions)) {
      const thumbnailPath = await convertFromPdf(document.path, {
        numberOfPages: options.pages,
      });
      await cleanFiles([document.path]);
      const images = (await thumbnailsFromImages(thumbnailPath.output, options)).output;
      await cleanFiles(thumbnailPath.output);
      return images;
    }

    if (isFileType(document.mime, document.filename, imageExtensions)) {
      const images = (await thumbnailsFromImages([document.path], options)).output;
      await cleanFiles([document.path]);
      return images;
    }

    if (isFileType(document.mime, document.filename, videoExtensions)) {
      try {
        const images = await generateVideoPreview([document.path]);
        await cleanFiles([document.path]);

        return images;
      } catch (error) {
        throw Error("failed to generate video preview");
      }
    }

    throw "Can not proccess, file type can't be defined";
  }
}
