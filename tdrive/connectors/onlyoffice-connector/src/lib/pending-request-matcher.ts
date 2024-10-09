import logger from './logger';

export type PendingRequestCallback<TResult> = (timeout: boolean, result?: TResult) => Promise<void>;

/** Represents a single pending query that can be resolved with success or failure */
class PendingRequest<TResult> {
  private readonly startedAt = new Date();
  private callbacks?: PendingRequestCallback<TResult>[] = [];

  constructor(public readonly key: string, public readonly userdata: string, callback: PendingRequestCallback<TResult>) {
    this.addCallback(callback);
  }

  public addCallback(callback: PendingRequestCallback<TResult>) {
    if (!this.callbacks) throw new Error("Cannot add callback to PendingRequest after it's been resolved");
    this.callbacks.push(callback);
    return this;
  }

  public getAge() {
    return new Date().getTime() - this.startedAt.getTime();
  }

  public matches(key: string, userdata: string) {
    return this.key === key && this.userdata === userdata;
  }

  public async resolve(...cbArgs: Parameters<PendingRequestCallback<TResult>>) {
    if (!this.callbacks) throw new Error("Cannot resolve PendingRequest after it's already been resolved");
    const callbacks = this.callbacks;
    this.callbacks = null;
    return Promise.all(callbacks.map(fn => fn(...cbArgs)));
  }
}

/**
 * Tracks a list of pending requests that are started with a pair
 * of `key` and `userdata` strings. (Note. `userdata` is not the
 * typical use of user data as a `void *`, but instead used to
 * identify the specific request asynchroneously).
 * Both must match.
 *
 * There is no timing garantee as to when expired requests' callbacks
 * are executed.
 */
export class PendingRequestQueue<TResult> {
  private queue: PendingRequest<TResult>[] = [];

  constructor(private readonly timeoutMs: number, niquystSamplingRatio = 4) {
    setInterval(() => {
      this.flush();
    }, timeoutMs / niquystSamplingRatio);
  }

  /**
   * Add a callback to be called when `gotResult` or `cancelPending` are
   * called with identical `key` and `userdata`
   * @param key First half of identifying string
   * @param userdata Second half of identifying string
   * @param callback When the request is resolved, succesfully or in error
   */
  public enqueue(key: string, userdata: string, callback: PendingRequestCallback<TResult>) {
    const existing = this.queue.find(pending => pending.key === key && pending.userdata === userdata);
    if (existing) return void existing.addCallback(callback);
    this.queue.push(new PendingRequest(key, userdata, callback));
  }

  private remove(predicate: (request: PendingRequest<TResult>) => boolean): PendingRequest<TResult>[] {
    // Warning: This operation must be synchroneous
    const foundRequests = [];
    this.queue = this.queue.filter(pending => {
      if (!predicate(pending)) return true;
      foundRequests.push(pending);
      return false;
    });
    return foundRequests;
  }

  private async resolve(predicate: (request: PendingRequest<TResult>) => boolean, ...cbArgs: Parameters<PendingRequestCallback<TResult>>) {
    const foundRequests = this.remove(predicate);
    if (!foundRequests.length) return null;
    return Promise.all(foundRequests.map(request => request.resolve(...cbArgs)));
  }

  protected async flush() {
    const expiredRequests = this.remove(request => request.getAge() > this.timeoutMs);
    return Promise.all(expiredRequests.map(request => request.resolve(true)));
  }

  public async gotResult(key: string, userdata: string, result?: TResult) {
    const resolutions = this.resolve(request => request.matches(key, userdata), false, result);
    if (!resolutions)
      logger.error(`Got resolution on pending request that was unknown`, {
        key,
        userdata,
        result,
      });
    await this.flush();
    return resolutions;
  }

  /** Equivalent to `gotResult` with an `undefined` result. (Callbacks are called) */
  public async cancelPending(key: string, userdata: string) {
    return this.gotResult(key, userdata, undefined);
  }
}
