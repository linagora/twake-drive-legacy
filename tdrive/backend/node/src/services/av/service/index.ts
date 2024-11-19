import { Initializable, TdriveServiceProvider } from "../../../core/platform/framework";
import { getLogger, logger, TdriveLogger } from "../../../core/platform/framework";
import NodeClam from "clamscan";
import { AVStatus, DriveFile } from "src/services/documents/entities/drive-file";
import { FileVersion } from "src/services/documents/entities/file-version";
import { DriveExecutionContext } from "src/services/documents/types";
import globalResolver from "../../../services/global-resolver";
import { getFilePath } from "../../files/services";
import { getConfigOrDefault } from "../../../utils/get-config";
import { AVException } from "./av-exception";

export class AVServiceImpl implements TdriveServiceProvider, Initializable {
  version: "1";
  av: NodeClam = null;
  logger: TdriveLogger = getLogger("Antivirus Service");
  avEnabled = getConfigOrDefault("drive.featureAntivirus", false);
  private MAX_FILE_SIZE = getConfigOrDefault("av.maxFileSize", 26214400); // 25 MB

  async init(): Promise<this> {
    try {
      if (this.avEnabled) {
        this.av = await new NodeClam().init({
          removeInfected: false, // Do not remove infected files
          quarantineInfected: false, // Do not quarantine, just alert
          scanLog: null, // No log file for this test
          debugMode: getConfigOrDefault("av.debugMode", false), // Enable debug messages
          clamdscan: {
            host: getConfigOrDefault("av.host", "localhost"), // IP of the server
            port: getConfigOrDefault("av.port", 3310) as number, // ClamAV server port
            timeout: getConfigOrDefault("av.timeout", 2000), // Timeout for scans
            localFallback: true, // Use local clamscan if needed
          },
        });
      }
    } catch (error) {
      logger.error({ error: `${error}` }, "Error while initializing Antivirus Service");
      throw AVException.initializationFailed("Failed to initialize Antivirus service");
    }
    return this;
  }

  async scanDocument(
    item: Partial<DriveFile>,
    version: Partial<FileVersion>,
    onScanComplete: (status: AVStatus) => Promise<void>,
    context: DriveExecutionContext,
  ): Promise<AVStatus> {
    try {
      // get the file from the storage
      const file = await globalResolver.services.files.get(
        version.file_metadata.external_id,
        context,
      );
      // check if the file is too large
      if (file.upload_data.size > this.MAX_FILE_SIZE) {
        this.logger.info(
          `File ${file.id} is too large (${file.upload_data.size} bytes) to be scanned. Skipping...`,
        );
        return "skipped";
      }

      // read the file from the storage
      const readableStream = await globalResolver.platformServices.storage.read(getFilePath(file), {
        totalChunks: file.upload_data.chunks,
        encryptionAlgo: globalResolver.services.files.getEncryptionAlgorithm(),
        encryptionKey: file.encryption_key,
      });

      // scan the file
      this.av.scanStream(readableStream, async (err, { isInfected, viruses }) => {
        if (err) {
          await onScanComplete("scan_failed");
          this.logger.error(`Scan failed for item ${item.id} due to error: ${err.message}`);
        } else if (isInfected) {
          await onScanComplete("malicious");
          this.logger.info(`Item ${item.id} is malicious. Viruses found: ${viruses.join(", ")}`);
        } else {
          await onScanComplete("safe");
          this.logger.info(`Item ${item.id} is safe with no viruses detected.`);
        }
      });

      return "scanning";
    } catch (error) {
      // mark the file as failed to scan
      await onScanComplete("scan_failed");

      // log the error
      this.logger.error(`Error scanning file ${item.last_version_cache.file_metadata.external_id}`);
      throw AVException.scanFailed("Document scanning encountered an error");
    }
  }
}
