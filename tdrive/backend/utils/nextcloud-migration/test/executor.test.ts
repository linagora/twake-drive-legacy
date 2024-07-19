import { describe, expect, test } from "@jest/globals";
import { FunctionExecutor } from "../src/executor";

describe('Function Executor tests', () => {

  const subj = new FunctionExecutor();

  test('Should successfully execute mock function', async () => {
    //when
    await subj.executeWithRetries(successFunction, [1, 2], 3);
    await subj.executeWithRetries(successFunction, [4, 5], 3);

    //then
    let stats = await subj.getStats();
    expect(stats?.get("successFunction")?.successfulExecutions).toEqual(2);
  });

  test('Should successfully gather arguments of the failed executions', async () => {
    await subj.executeWithRetries(failedFunction, [1, 2], 3);

    //then
    let stats = await subj.getStats();
    expect(stats?.get("failedFunction")?.failedExecutions).toBe(1);
    expect(stats?.get("failedFunction")?.failedExecutionsArgs[0]).toStrictEqual([1, 2]);
  });

  test('Should successfully gather arguments of the class member', async () => {
    await subj.executeWithRetries(subj.getStats.bind(this), [1, 2], 3);

    //then
    let stats = await subj.getStats();
    expect(stats?.get("bound getStats")?.successfulExecutions).toEqual(1);
  });

  const successFunction = async (a: number, b: number) => {
    return a + b;
  };

  const failedFunction = async () => {
    throw new Error();
  };

});
