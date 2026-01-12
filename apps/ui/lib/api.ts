const DEFAULT_AGENT_CORE_URL = "http://localhost:3000";

function normalizeBaseUrl(input: string): string | null {
  const candidate = input.trim();
  if (candidate.length === 0) return null;

  try {
    const withScheme =
      candidate.startsWith("http://") || candidate.startsWith("https://")
        ? candidate
        : `http://${candidate}`;
    const url = new URL(withScheme);
    const normalizedPath = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${normalizedPath}`;
  } catch {
    return null;
  }
}

/**
 * Returns the configured Agent Core base URL.
 *
 * Reads `NEXT_PUBLIC_AGENT_CORE_URL` and falls back to `http://localhost:3000`.
 * The returned value is normalized (no trailing slash, optional base path kept).
 */
export function getAgentCoreBaseUrl(): string {
  const fromEnv = normalizeBaseUrl(process.env.NEXT_PUBLIC_AGENT_CORE_URL ?? "");
  return fromEnv ?? DEFAULT_AGENT_CORE_URL;
}

/**
 * Builds a fully-qualified URL for an Agent Core endpoint.
 *
 * - Safe joining via WHATWG URL (avoids double slashes)
 * - Treats both "v1/chat" and "/v1/chat" as relative to the base (keeps base path prefixes)
 * - Optional query params (skips null/undefined)
 */
export function buildAgentCoreUrl(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): string {
  const base = getAgentCoreBaseUrl();

  const trimmedPath = path.trim();
  if (trimmedPath.length === 0) return base;

  const baseForJoin = base.endsWith("/") ? base : `${base}/`;
  const relativePath = trimmedPath.replace(/^\/+/, "");
  const url = new URL(relativePath, baseForJoin);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}


