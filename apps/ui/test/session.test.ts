import { describe, expect, it } from 'vitest';
import { clearSessionId, loadSessionId, saveSessionId } from '../lib/session';

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe('sessionId persistence', () => {
  it('loads, saves, and clears sessionId', () => {
    const storage = new MemoryStorage();

    expect(loadSessionId(storage)).toBeNull();

    saveSessionId(storage, 'abc');
    expect(loadSessionId(storage)).toBe('abc');

    clearSessionId(storage);
    expect(loadSessionId(storage)).toBeNull();
  });
});


