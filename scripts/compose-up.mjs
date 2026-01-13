import { getRepoRoot, pickComposeEnvFile } from "./_sentinel-env.mjs";
import { runProcess } from "./_proc.mjs";

const repoRoot = getRepoRoot();
const envFile = pickComposeEnvFile(repoRoot);

const baseArgs = ["compose", "-f", "infra/compose.yml"];
if (envFile) baseArgs.push("--env-file", envFile);

// Default behavior: docker compose up --build (foreground).
const extraArgs = process.argv.slice(2);
const args = [...baseArgs, "up", "--build", ...extraArgs];

await runProcess("docker", args, { cwd: repoRoot });

