import { AsyncLocalStorage } from "async_hooks";

export interface ExecutionContext {
  request_id: string;
  user_id: string;
  user_email: string;
  company_id: string;
}

export const executionStorage = new AsyncLocalStorage<ExecutionContext>();
executionStorage.enterWith({} as ExecutionContext);
