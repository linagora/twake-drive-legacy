import logger from './logger';

export class CannotSettleAlreadyReleasedLockError extends Error {}

const debugLocks = false;

/** Simplifies use of the Promise constructor function out of its scope */
class ExplodedPromise<T> {
  public readonly startAtMs = new Date().getTime();
  public readonly promise: Promise<T>;
  private _waiters = 0;
  private _resolve: (value: T) => void;
  private _reject: (reason?: any) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      // Works because this is garanteed to be called synchroneously
      this._resolve = resolve;
      this._reject = reject;
    });
  }
  private check() {
    if (!this._resolve) throw new CannotSettleAlreadyReleasedLockError(`Promise is already settled`);
  }
  private finish() {
    this._resolve = this._reject = null;
  }
  /** Increase waiter count and return new count */
  public addWaiter() {
    return ++this._waiters;
  }
  get waiting() {
    return this._waiters;
  }
  public resolve(...args: Parameters<ExplodedPromise<T>['_resolve']>): void {
    this.check();
    this._resolve(...args);
    this.finish();
  }
  public reject(...args: Parameters<ExplodedPromise<T>['_reject']>): void {
    this.check();
    this._reject(...args);
    this.finish();
  }
}

/**
 * Use this instance to release the lock acquired by {@link SingleProcessorLock.acquire}.
 * Only call either `resolve` or `reject` once or they will
 * throw a {@link CannotSettleAlreadyReleasedLockError}.
 */
export interface LockReleaser<T> {
  /** To distinguish return from {@link LockWaiter} */
  didAcquire: true;
  /** This is the same Promise that `resolve` and `reject` will settle, and waiters get */
  promise: LockWaiter<T>['promise'];
  /** Release the lock and resolve the promise of all the waiters */
  resolve: ExplodedPromise<T>['resolve'];
  /** Release the lock and reject the promise of all the waiters */
  reject: ExplodedPromise<T>['reject'];
}

/** Use this instance to wait if {@link SingleProcessorLock.acquire} was already processing that key */
export interface LockWaiter<T> {
  /** To distinguish return from {@link LockReleaser} */
  didAcquire: false;
  /** Number of waiters in the queue at the start of this one, including this one (ie. first to wait is `1`) */
  numberInQueue: number;
  /** Promise that must be waited for after the acquire failed. Will settle as per called by the {@see LockReleaser} */
  promise: Promise<T>;
}

/**
 * Create an synchronisation primitive that permits a single caller
 * to process for a given `key`. Other callers with the same `key`
 * will receive an `Promise` that should be waited for. When the
 * processor caller releases the lock, the promise is settled accordingly.
 */
export function createSingleProcessorLock<T>() {
  const promisesByKey = new Map<string, ExplodedPromise<T>>();

  /**
   * The first caller for the given `key` is the processor that must settle the lock. The
   * return value will be an instance of {@link LockReleaser} that can be tested because
   * {@link LockReleaser.didAcquire} will be `true`. This caller has the responsibility to
   * ensure a call to either {@link LockReleaser.resolve} or {@link LockReleaser.reject}.
   * There is no other cleanup mecanism.
   *
   * All callers following them for the same `key` will get an instance of {@link LockWaiter},
   * that can be tested because {@link LockWaiter.didAcquire} will be `false`. They must
   * `await` {@link LockWaiter.promise}. It will be settled by the processor when they call
   * the methods of {@link LockReleaser}. must be ensured, there is no cleanup mecanism.
   *
   * @param key Unique key to lock on
   */
  const acquire = (key: string): LockReleaser<T> | LockWaiter<T> => {
    const existing = promisesByKey.get(key);
    if (existing) {
      const numberInQueue = existing.addWaiter();
      debugLocks && logger.debug(`LOCK blocked ${numberInQueue}: ${key}`);
      return {
        didAcquire: false,
        numberInQueue,
        promise: existing.promise,
      };
    }
    const processorPromise = new ExplodedPromise<T>();
    promisesByKey.set(key, processorPromise);
    debugLocks && logger.debug(`LOCK started: ${key}`);
    return {
      didAcquire: true,
      promise: processorPromise.promise,
      resolve(...args: Parameters<LockReleaser<T>['resolve']>) {
        debugLocks && logger.debug(`LOCK resolved: ${key}`);
        promisesByKey.delete(key);
        processorPromise.resolve(...args);
      },
      reject(...args: Parameters<LockReleaser<T>['reject']>) {
        debugLocks && logger.debug(`LOCK rejected: ${key}`);
        promisesByKey.delete(key);
        processorPromise.reject(...args);
      },
    };
  };
  return {
    acquire,

    /**
     * Attempt to acquire a lock. If succesful, settle the promise with the
     * return value of `processor`. In both cases return the Promise.
     */
    async runWithLock(key: string, processor: () => Promise<T>): Promise<T> {
      const lock = acquire(key);
      if (lock.didAcquire)
        try {
          lock.resolve(await processor());
        } catch (e) {
          lock.reject(e);
        }
      return lock.promise;
    },

    /** Get statistics about pending locks */
    getWorstStats() {
      const all = [...promisesByKey.values()];
      const now = new Date().getTime();
      return all.reduce(
        ({ oldestMs, waiting, total }, cur) => ({
          oldestMs: Math.max(oldestMs, now - cur.startAtMs),
          waiting: Math.max(waiting, cur.waiting),
          total: total + 1,
        }),
        {
          oldestMs: 0,
          waiting: 0,
          total: 0,
        },
      );
    },
  };
}
