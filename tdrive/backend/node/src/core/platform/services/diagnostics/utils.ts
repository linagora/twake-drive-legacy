import { logger } from "../../framework";
import { Readable, Transform } from "node:stream";
import { Session } from "node:inspector/promises";

/** Time the execution of the callback, and return its duration in ms with the result */
export async function timeCallback<T>(
  cb: () => Promise<T>,
): Promise<{ durationMs: number; result: T }> {
  const startMs = new Date().getTime();
  const result = await cb();
  return { durationMs: new Date().getTime() - startMs, result };
}

/** Use `node:inspector` to create a snapshot of the heap, and
 * synchroneously (because of session.post) pipe it to a stream
 * readable from the first argument of the callback.
 */
export async function getHeapSnapshotSync(cb: (readable: Readable) => void) {
  logger.info({ gcExposed: !!global.gc }, "Beginning heap snapshot");
  if (global.gc) global.gc();
  const session = new Session();
  session.connect();
  try {
    const transform = new Transform();
    try {
      let size = 0;
      await session.post("HeapProfiler.enable");
      session.on("HeapProfiler.addHeapSnapshotChunk", message => {
        size += message.params.chunk.length;
        transform.push(message.params.chunk);
      });
      cb(transform);
      await session.post("HeapProfiler.takeHeapSnapshot", null);
      logger.info({ size }, "Heap snapshot sent");
    } finally {
      transform.end();
    }
  } finally {
    session.disconnect();
  }
}
