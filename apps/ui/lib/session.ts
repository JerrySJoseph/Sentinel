export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const SESSION_ID_STORAGE_KEY = 'sentinel.sessionId';

export function loadSessionId(storage: StorageLike): string | null {
  try {
    return storage.getItem(SESSION_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveSessionId(storage: StorageLike, sessionId: string): void {
  try {
    storage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
  } catch {
    // ignore
  }
}

export function clearSessionId(storage: StorageLike): void {
  try {
    storage.removeItem(SESSION_ID_STORAGE_KEY);
  } catch {
    // ignore
  }
}


