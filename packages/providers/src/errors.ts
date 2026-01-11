export class ProviderNotFoundError extends Error {
  readonly providerName: string;

  constructor(providerName: string) {
    super(`Provider not found: ${providerName}`);
    this.name = 'ProviderNotFoundError';
    this.providerName = providerName;
  }
}

export class ProviderRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderRegistryError';
  }
}

