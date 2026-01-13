import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export function getRepoRoot() {
  // scripts/ lives at <repo>/scripts
  return resolve(import.meta.dirname, "..");
}

export function pickComposeEnvFile(repoRoot) {
  const candidates = [
    resolve(repoRoot, "infra", ".env"),
    resolve(repoRoot, "infra", "env.example"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function parseDotEnvFile(envFilePath) {
  if (!envFilePath || !existsSync(envFilePath)) return {};
  const raw = readFileSync(envFilePath, "utf8");
  const out = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    // Strip surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }

  return out;
}

export function buildLocalDatabaseUrl(envFromFile = {}) {
  const user = envFromFile.POSTGRES_USER || "sentinel";
  const password = envFromFile.POSTGRES_PASSWORD || "sentinel";
  const db = envFromFile.POSTGRES_DB || "sentinel";
  const host = "localhost";
  const port = "5432";
  const schema = "public";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(db)}?schema=${schema}`;
}

