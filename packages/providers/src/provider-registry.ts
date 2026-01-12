import { ProviderNotFoundError, ProviderRegistryError } from './errors';
import { LLMProvider, ProviderName, ToggleableProvider } from './types';

export class ProviderRegistry {
  private readonly providers = new Map<ProviderName, LLMProvider>();

  register(provider: LLMProvider): void {
    if (isToggleableProvider(provider) && !provider.isEnabled()) {
      throw new ProviderRegistryError(`Provider is disabled: ${provider.name}`);
    }
    if (this.providers.has(provider.name)) {
      throw new ProviderRegistryError(`Provider already registered: ${provider.name}`);
    }
    this.providers.set(provider.name, provider);
  }

  has(name: ProviderName): boolean {
    return this.providers.has(name);
  }

  get(name: ProviderName): LLMProvider {
    const provider = this.providers.get(name);
    if (!provider) throw new ProviderNotFoundError(name);
    return provider;
  }

  list(): ProviderName[] {
    return Array.from(this.providers.keys()).sort();
  }

  /**
   * Resolve a provider by explicit name or (if omitted) by selecting the sole
   * registered provider. Throws if ambiguous or empty.
   */
  resolve(preferredName?: ProviderName): LLMProvider {
    if (preferredName) return this.get(preferredName);

    const names = this.list();
    if (names.length === 0) {
      throw new ProviderRegistryError('No providers registered');
    }
    if (names.length > 1) {
      throw new ProviderRegistryError(
        `Multiple providers registered (${names.join(', ')}); specify one explicitly`
      );
    }
    return this.get(names[0]);
  }
}

function isToggleableProvider(provider: LLMProvider): provider is ToggleableProvider {
  return typeof (provider as ToggleableProvider).isEnabled === 'function';
}

