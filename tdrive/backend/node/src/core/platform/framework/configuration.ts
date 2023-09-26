import { IConfig } from "config";
import configuration from "../../config";
import { TdriveServiceConfiguration } from "./api";
export class Configuration implements TdriveServiceConfiguration {
  configuration: IConfig;
  serviceConfiguration: IConfig;

  constructor(path: string) {
    try {
      this.serviceConfiguration = configuration.get(path);
    } catch {
      // NOP
    }
  }

  get<T>(name?: string, defaultValue?: T): T {
    let value: T;

    try {
      value = this.serviceConfiguration as unknown as T;
      if (name) {
        value =
          this.serviceConfiguration &&
          (this.serviceConfiguration.get<T>(name) || configuration.get<T>(name));
      }
    } catch {
      value = defaultValue || null;
    } finally {
      return value;
    }
  }
}
