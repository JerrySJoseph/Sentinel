import { resolve } from "node:path";
import {
  buildLocalDatabaseUrl,
  getRepoRoot,
  parseDotEnvFile,
  pickComposeEnvFile,
} from "./_sentinel-env.mjs";
import {
  runProcess,
  runProcessWithRetries,
  startProcess,
} from "./_proc.mjs";

const repoRoot = getRepoRoot();
const envFile = pickComposeEnvFile(repoRoot);
const envFromFile = parseDotEnvFile(envFile);
const databaseUrl = buildLocalDatabaseUrl(envFromFile);

const composeBaseArgs = ["compose", "-f", "infra/compose.yml"];
if (envFile) composeBaseArgs.push("--env-file", envFile);

// 1) Bring up infra (Postgres) in the background.
await runProcess("docker", [...composeBaseArgs, "up", "-d", "postgres"], {
  cwd: repoRoot,
});

// 2) Prisma: generate + migrate deploy (with retry for Postgres readiness).
const memoryEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  // Keep Prisma cache local to the repo (helps in sandboxed environments).
  XDG_CACHE_HOME: resolve(repoRoot, "packages", "memory", ".cache"),
};

await runProcess("pnpm", ["--filter", "@sentinel/memory", "exec", "prisma", "generate"], {
  cwd: repoRoot,
  env: memoryEnv,
});

await runProcessWithRetries(
  "pnpm",
  ["--filter", "@sentinel/memory", "exec", "prisma", "migrate", "deploy"],
  { retries: 20, delayMs: 1500, options: { cwd: repoRoot, env: memoryEnv } },
);

// 3) Build workspace packages required by agent-core (and UI contracts).
await runProcess("pnpm", ["--filter", "@sentinel/contracts", "build"], {
  cwd: repoRoot,
});
await runProcess("pnpm", ["--filter", "@sentinel/tools", "build"], { cwd: repoRoot });
await runProcess("pnpm", ["--filter", "@sentinel/providers", "build"], { cwd: repoRoot });

// Build @sentinel/memory without relying on shell-specific prebuild scripts.
await runProcess(
  "pnpm",
  ["--filter", "@sentinel/memory", "exec", "tsc", "-p", "tsconfig.json"],
  { cwd: repoRoot },
);

// Build @sentinel/agent without triggering its prebuild (which shells out).
await runProcess("pnpm", ["--filter", "@sentinel/agent", "exec", "tsc", "-p", "tsconfig.json"], {
  cwd: repoRoot,
});

// 4) Start agent-core + UI (watch mode) concurrently.
const agentCore = startProcess(
  "pnpm",
  ["--filter", "agent-core", "start:dev"],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PORT: "3000",
    },
  },
);

const ui = startProcess(
  "pnpm",
  ["--filter", "ui", "dev"],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: "3001",
      NEXT_PUBLIC_AGENT_CORE_URL: "http://localhost:3000",
    },
  },
);

function shutdown(signal) {
  // Stop child processes; leave docker infra running (use `pnpm down` to stop).
  if (agentCore.exitCode == null) agentCore.kill(signal);
  if (ui.exitCode == null) ui.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const exitCode = await new Promise((resolve) => {
  let resolved = false;
  const finish = (code) => {
    if (resolved) return;
    resolved = true;
    resolve(code);
  };

  agentCore.on("close", (code) => {
    // If one process exits, stop the other and exit.
    shutdown("SIGTERM");
    finish(code ?? 0);
  });

  ui.on("close", (code) => {
    shutdown("SIGTERM");
    finish(code ?? 0);
  });
});

process.exit(exitCode);

