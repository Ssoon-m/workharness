#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { registerInit } from "./commands/init.mjs";
import { registerUpgrade } from "./commands/upgrade.mjs";
import { registerAdd } from "./commands/add.mjs";
import { registerSync } from "./commands/sync.mjs";
import { registerDoctor } from "./commands/doctor.mjs";
import { registerDashboard } from "./commands/dashboard.mjs";

export const cliDir = dirname(fileURLToPath(import.meta.url));
export const packageRoot = resolve(cliDir, "..");
const pkg = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));

const program = new Command();

program
  .name("phaseharness")
  .description("Install and manage PhaseHarness in a project")
  .version(pkg.version);

registerInit(program, { packageRoot, packageVersion: pkg.version });
registerUpgrade(program, { packageRoot, packageVersion: pkg.version });
registerAdd(program, { packageRoot, packageVersion: pkg.version });
registerSync(program);
registerDoctor(program);
registerDashboard(program);

program.parseAsync(process.argv).catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(1);
});
