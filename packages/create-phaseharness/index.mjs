#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));

function resolveCreatePath() {
  if (process.env.PHASEHARNESS_CREATE_PATH) {
    return resolve(process.env.PHASEHARNESS_CREATE_PATH);
  }
  const sourceCheckoutPath = resolve(packageDir, "../../src/create.mjs");
  if (existsSync(sourceCheckoutPath)) {
    return sourceCheckoutPath;
  }
  const require = createRequire(import.meta.url);
  const packageJsonPath = require.resolve("phaseharness/package.json");
  return resolve(dirname(packageJsonPath), "src/create.mjs");
}

const result = spawnSync(process.execPath, [resolveCreatePath(), ...process.argv.slice(2)], {
  stdio: "inherit"
});

if (result.error) {
  console.error(`error: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
