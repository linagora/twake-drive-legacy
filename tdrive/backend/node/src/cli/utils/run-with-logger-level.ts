import { logger } from "../../core/platform/framework/logger";

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

/** Run the callback with the provided log level set (if undefined it's left identical).
 * Restores the previous level before returning.
 */
export default async function runWithLoggerLevel<R = void>(
  level: LogLevel | undefined,
  callback: () => R,
) {
  if (level === undefined) return await callback();
  const previousLogLevel = logger.level;
  try {
    logger.level = level;
    return await callback();
  } finally {
    logger.level = previousLogLevel;
  }
}
