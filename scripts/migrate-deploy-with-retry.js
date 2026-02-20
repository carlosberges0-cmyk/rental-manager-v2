#!/usr/bin/env node
/**
 * Runs `prisma migrate deploy` with retries to handle P1002 (advisory lock timeout).
 * Use in CI/deploy when the DB can be slow or another process may hold the lock briefly.
 */
const { execSync } = require("child_process");
const maxAttempts = 3;
const delayMs = 8000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[migrate-deploy] Attempt ${attempt}/${maxAttempts}...`);
      execSync("npx prisma migrate deploy", {
        stdio: "inherit",
        env: process.env,
      });
      console.log("[migrate-deploy] Done.");
      process.exit(0);
    } catch (err) {
      const out = (err.stdout && err.stdout.toString()) || "";
      const errOut = (err.stderr && err.stderr.toString()) || "";
      const isLockTimeout = /P1002|advisory lock|timed out/i.test(out + errOut);
      if (isLockTimeout && attempt < maxAttempts) {
        console.warn(`[migrate-deploy] Lock timeout (P1002). Waiting ${delayMs / 1000}s before retry...`);
        await sleep(delayMs);
      } else {
        process.exit(err.status ?? 1);
      }
    }
  }
  process.exit(1);
}

main();
