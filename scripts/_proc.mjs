import { spawn } from "node:child_process";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function startProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });

  return child;
}

export async function runProcess(command, args, options = {}) {
  const child = startProcess(command, args, options);
  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    const cmd = [command, ...args].join(" ");
    throw new Error(`Command failed (${exitCode}): ${cmd}`);
  }
}

export async function runProcessWithRetries(
  command,
  args,
  { retries = 10, delayMs = 1500, options = {} } = {},
) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await runProcess(command, args, options);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
}

