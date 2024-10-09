import logger from './logger';

const now = () => new Date().getTime();
type NotUndefined<T> = T extends undefined ? never : T;

/**
 * Hold a value that is periodically obtained from a fallible process, and
 * track update times and errors.
 */
export class PolledThingieValue<ValueType> {
  private lastOkTimeMs: number | undefined;
  private lastKoTimeMs: number | undefined;
  protected lastValue: ValueType | undefined;
  protected lastKoError: any;
  protected pendingTry: Promise<ValueType | undefined> | undefined;

  constructor(
    private readonly logPrefix: string,
    private readonly getTheThingieValue: () => Promise<NotUndefined<ValueType>>,
    private readonly intervalMs: number,
  ) {
    this.runIgnoringRejection();
    setInterval(() => this.runIgnoringRejection(), this.intervalMs);
  }

  protected setResult(value: undefined, error?: NotUndefined<ValueType>, ts?: number);
  protected setResult(value: NotUndefined<ValueType>, error?: undefined, ts?: number);
  protected setResult(value: ValueType | undefined, error?: any, ts = now()) {
    if (value && error) throw new Error(`Unexpected value (${JSON.stringify(value)}) and error (${JSON.stringify(error)})`);
    if (error) this.lastKoTimeMs = ts;
    else this.lastOkTimeMs = ts;
    this.lastValue = value;
    this.lastKoError = error;
    if (error) logger.error(this.logPrefix + ' error:', error.stack);
  }

  private async run() {
    if (this.pendingTry) return this.pendingTry;
    return (this.pendingTry = new Promise((resolve, reject) => {
      this.getTheThingieValue().then(
        value => {
          this.setResult(value === undefined ? null : value);
          this.pendingTry = undefined;
          resolve(value);
        },
        error => {
          this.setResult(undefined, error.stack);
          this.pendingTry = undefined;
          reject(error);
        },
      );
    }));
  }

  private runIgnoringRejection() {
    return this.run().catch(() => {
      /* active ignoring going on here */
    });
  }

  public lastFailed() {
    return !!this.lastKoTimeMs;
  }

  public hasValue() {
    return !!this.lastOkTimeMs;
  }

  /** Get the latest value and age in seconds if it was successful, or `undefined` */
  public latest(): { value: ValueType; ageS: number } | undefined {
    if (!this.hasValue()) return undefined;
    return {
      value: this.lastValue,
      ageS: Math.floor((now() - this.lastOkTimeMs) / 1000),
    };
  }

  /** Get the latest value if it was successful, or `undefined` */
  public latestValue(): ValueType | undefined {
    if (!this.hasValue()) return undefined;
    return this.lastValue;
  }

  /**
   * Get a promise to the latest value. If there isn't one, try to get one first.
   * New requests when one is already pending will not cause a separate run,
   * but get the previous promise back.
   **/
  public async latestValueWithTry(): Promise<ValueType | undefined> {
    if (this.hasValue()) return this.lastValue;
    if (this.pendingTry) return this.pendingTry;
    return this.run();
  }

  /**
   * Use {@see latestValueWithTry} and if the result is still `undefined`, reject
   * the promise with the provided `errorMessage`.
   **/
  public async requireLatestValueWithTry(errorMessage: string): Promise<ValueType> {
    const result = await this.latestValueWithTry();
    if (result === undefined) throw new Error(errorMessage);
    return result;
  }
}
