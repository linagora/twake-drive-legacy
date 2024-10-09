const providers: IHealthProvider[] = [];

export interface IHealthProvider {
  getHealthData(): Promise<{ [key: string]: unknown }>;
}

export function registerHealthProvider(provider: IHealthProvider) {
  providers.push(provider);
}

export function getProviders() {
  return providers;
}
