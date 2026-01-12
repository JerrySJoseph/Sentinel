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

export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConfigError';
  }
}

export class MissingApiKeyError extends ProviderConfigError {
  readonly envVar: string;

  constructor(envVar: string) {
    super(`Missing required API key: ${envVar}`);
    this.name = 'MissingApiKeyError';
    this.envVar = envVar;
  }
}

export class ProviderDisabledInTestError extends ProviderConfigError {
  constructor(providerName: string) {
    super(`Provider "${providerName}" is disabled in tests`);
    this.name = 'ProviderDisabledInTestError';
  }
}

