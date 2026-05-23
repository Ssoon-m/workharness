#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const createDir = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(createDir, "cli.mjs");
const passthroughCommands = new Set([
  "init",
  "upgrade",
  "add",
  "sync",
  "doctor",
  "dashboard"
]);

const args = process.argv.slice(2);
const forwarded = args.length && passthroughCommands.has(args[0])
  ? args
  : ["init", ...args];

const result = spawnSync(process.execPath, [cliPath, ...forwarded], {
  stdio: "inherit"
});

if (result.error) {
  console.error(`error: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
