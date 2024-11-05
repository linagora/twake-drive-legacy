import { Initializable, TdriveServiceProvider } from "../../../core/platform/framework";
import { getLogger, logger, TdriveLogger } from "../../../core/platform/framework";
import NodeClam from "clamscan";
import { DriveFile } from "src/services/documents/entities/drive-file";
import { FileVersion } from "src/services/documents/entities/file-version";
import { DriveExecutionContext } from "src/services/documents/types";
import globalResolver from "../../../services/global-resolver";
import { getFilePath } from "../../files/services";
import { getConfigOrDefault } from "../../../utils/get-config";

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
      throw error;
    }
    return this;
  }

  async scanDocument(
    item: Partial<DriveFile>,
    version: Partial<FileVersion>,
    context: DriveExecutionContext,
  ): Promise<void> {
    const repo = globalResolver.services.documents.documents.repository;
    const driveItem = await repo.findOne(
      {
        id: item.id,
        company_id: context.company.id,
      },
      {},
      context,
    );
    try {
      // get the file from the storage
      const file = await globalResolver.services.files.get(
        version.file_metadata.external_id,
        context,
      );

      // check if the file is too large
      if (driveItem.size > this.MAX_FILE_SIZE) {
        this.logger.info(
          `File ${file.id} is too large (${driveItem.size} bytes) to be scanned. Skipping...`,
        );
        driveItem.av_status = "skipped";
        await repo.save(driveItem);
        return;
      }

      // read the file from the storage
      const readableStream = await globalResolver.platformServices.storage.read(getFilePath(file), {
        totalChunks: file.upload_data.chunks,
        encryptionAlgo: globalResolver.services.files.getEncryptionAlgorithm(),
        encryptionKey: file.encryption_key,
      });

      // update the status of the drive item
      item.av_status = "scanning";
      await repo.save(driveItem);

      // scan the file
      this.av.scanStream(readableStream, async (err, { isInfected, viruses }) => {
        if (err) {
          driveItem.av_status = "scan_failed";
          this.logger.info(`Scan failed for item ${driveItem.id} due to error: ${err.message}`);
        } else if (isInfected) {
          driveItem.av_status = "malicious";
          this.logger.info(
            `Item ${driveItem.id} is malicious. Viruses found: ${viruses.join(", ")}`,
          );
        } else {
          driveItem.av_status = "safe";
          this.logger.info(`Item ${driveItem.id} is safe with no viruses detected.`);
        }

        // Save status to the repository and log completion
        await repo.save(driveItem);
        this.logger.info(
          `Completed scan for item ${driveItem.id} with final status: ${driveItem.av_status}`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error scanning file ${driveItem.last_version_cache.file_metadata.external_id}`,
      );
      driveItem.av_status = "scan_failed";
      await repo.save(driveItem);
    }
  }
}
