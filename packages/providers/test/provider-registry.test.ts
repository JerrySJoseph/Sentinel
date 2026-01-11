import { ProviderNotFoundError, ProviderRegistry, ProviderRegistryError } from '../src';

describe('ProviderRegistry', () => {
  it('registers and gets providers by name', () => {
    const registry = new ProviderRegistry();
    const provider = { name: 'a', plan: jest.fn() };

    registry.register(provider);

    expect(registry.has('a')).toBe(true);
    expect(registry.get('a')).toBe(provider);
  });

  it('throws on duplicate registration', () => {
    const registry = new ProviderRegistry();
    const provider = { name: 'a', plan: jest.fn() };
    registry.register(provider);

    expect(() => registry.register(provider)).toThrow(ProviderRegistryError);
  });

  it('throws ProviderNotFoundError when missing', () => {
    const registry = new ProviderRegistry();
    expect(() => registry.get('missing')).toThrow(ProviderNotFoundError);
  });

  it('resolves the sole provider when no preferred name is given', () => {
    const registry = new ProviderRegistry();
    const provider = { name: 'only', plan: jest.fn() };
    registry.register(provider);

    expect(registry.resolve()).toBe(provider);
  });

  it('throws when resolving with no providers', () => {
    const registry = new ProviderRegistry();
    expect(() => registry.resolve()).toThrow('No providers registered');
  });

  it('throws when resolving without preferred name and multiple providers exist', () => {
    const registry = new ProviderRegistry();
    registry.register({ name: 'a', plan: jest.fn() });
    registry.register({ name: 'b', plan: jest.fn() });

    expect(() => registry.resolve()).toThrow(ProviderRegistryError);
  });
});

