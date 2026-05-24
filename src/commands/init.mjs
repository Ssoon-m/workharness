import { checkbox } from "@inquirer/prompts";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  AGENTS,
  buildInstallManifest,
  enabledAgents,
  installPackageDependencies,
  ensurePackageScripts,
  ensureRuntimeState,
  installTemplate,
  parseAgents,
  readJson,
  requireTargetRoot,
  requirePython,
  runBridge,
  writeJson
} from "../lib/project.mjs";

export function registerInit(program, context) {
  program
    .command("init")
    .description("Install WorkHarness into the current directory")
    .option("--agents <agents>", "comma-separated agents to enable: codex,claude")
    .option("-y, --yes", "use defaults for prompts")
    .option("--force", "overwrite existing WorkHarness managed payload files")
    .option("--no-install", "skip package manager install after updating package.json")
    .action(async (options) => {
      const root = requireTargetRoot();
      requirePython();
      const installPath = resolve(root, ".workharness/install.json");
      const existing = readJson(installPath, {});
      if (existsSync(installPath) && !options.force) {
        throw new Error("WorkHarness is already installed. Run workharness upgrade to update it, or workharness add agent to enable another agent.");
      }
      if (existsSync(resolve(root, ".workharness")) && !existsSync(installPath) && !options.force) {
        throw new Error("Existing .workharness payload found. Re-run with --force to overwrite it.");
      }
      let agents = parseAgents(options.agents);
      if (!agents) {
        if (options.yes) {
          agents = enabledAgents(existing);
          if (!agents.length) agents = ["codex"];
        } else {
          agents = await checkbox({
            message: "Which agents should WorkHarness integrate with?",
            choices: AGENTS.map((agent) => ({
              name: agent === "codex" ? "Codex" : "Claude",
              value: agent,
              checked: agent === "codex"
            })),
            required: true
          });
        }
      }
      const result = installTemplate({ packageRoot: context.packageRoot, targetRoot: root, force: Boolean(options.force) });
      ensureRuntimeState(root);
      const packageScripts = ensurePackageScripts(root, { packageVersion: context.packageVersion });
      const packageInstall = installPackageDependencies(root, packageScripts, { enabled: options.install !== false });
      const install = buildInstallManifest({ packageVersion: context.packageVersion, agents, existing });
      writeJson(installPath, install);
      for (const agent of agents) {
        const args = ["install", "--provider", agent];
        runBridge(root, args);
      }
      if (result.skillsBackup) {
        console.log(`Existing WorkHarness skills backed up to ${result.skillsBackup}.`);
      }
      logPackageScripts(packageScripts);
      logPackageInstall(packageInstall);
      console.log(`WorkHarness installed for ${agents.join(", ")}.`);
    });
}

function logPackageScripts(result) {
  if (result.status === "missing") {
    console.log("No package.json found; skipped package scripts.");
    return;
  }
  if (result.changed.length) {
    console.log(`Added package scripts: ${result.changed.join(", ")}.`);
  }
  if (result.removed.length) {
    console.log(`Removed package scripts: ${result.removed.join(", ")}.`);
  }
  if (result.dependencyChanged) {
    console.log("Pinned workharness in devDependencies.");
  }
}

function logPackageInstall(result) {
  if (result.status === "installed") {
    console.log(`Installed package dependencies with ${result.manager}.`);
  }
  if (result.status === "skipped") {
    console.log(`Skipped package dependency install. Run ${result.manager} install before using package scripts.`);
  }
}
