export type KvSetOptions = {
  ttlMs?: number;
};

export interface KvBackend {
  /**
   * A stable identifier for the backend implementation (e.g. "noop", "redis").
   * Useful for logs/trace without coupling to a specific vendor.
   */
  readonly kind: string;

  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: KvSetOptions): Promise<void>;
  del(key: string): Promise<number>;

  /**
   * Best-effort cleanup (should never throw).
   */
  close(): Promise<void>;
}
