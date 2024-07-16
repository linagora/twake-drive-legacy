import { logger } from "./logger";

type FunctionArgs = any[];

type FunctionStats = {
  functionName: string;
  successfulExecutions: number;
  failedExecutions: number;
  failedExecutionsArgs: FunctionArgs[];
};

export class FunctionExecutor {
  private stats: Map<string, FunctionStats> = new Map();

  async executeWithRetries(
    fn: (...args: any[]) => Promise<any>,
    args: FunctionArgs,
    retries: number = 3,
    throwError: boolean = false,
  ): Promise<any> {
    const functionName = fn.name;
    let success = false;
    let executionResult = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        executionResult = await fn(...args);
        success = true;
        break;
      } catch (error) {
        executionResult = error;
        logger.info(`Attempt ${attempt + 1} failed for ${functionName}`, error);
      }
    }

    if (!success && throwError) throw executionResult;

    let stats = this.stats.get(functionName);
    if (!stats) {
      stats = {
        functionName,
        successfulExecutions: 0,
        failedExecutions: 0,
        failedExecutionsArgs: []
      };
      this.stats.set(functionName, stats);
    }

    if (success) {
      stats.successfulExecutions++;
    } else {
      stats.failedExecutions++;
      stats.failedExecutionsArgs.push( args );
    }
    return executionResult;
  }

  async getStats() {
    return this.stats;
  }

  printStatistics(): void {
    logger.info("Execution Statistics:");
    this.stats.forEach((stat) => {
      logger.info(
        `Function: ${stat.functionName}, Successful Executions: ${stat.successfulExecutions}, Failed Executions: ${stat.failedExecutions}`
      );
    });
  }

  printFailedExecutions(): void {
    logger.info("Failed Executions:");
    this.stats.forEach((execution) => {
      if (execution.failedExecutionsArgs.length > 0) {
        logger.info(`   Function: ${execution.functionName}`);
        execution.failedExecutionsArgs.forEach(args =>
          logger.info(`       args: ${JSON.stringify(args)}`));
      }
    });
  }
}