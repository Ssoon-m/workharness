import { checkbox } from "@inquirer/prompts";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  AGENTS,
  buildInstallManifest,
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
    .description("Install PhaseHarness into the current directory")
    .option("--agents <agents>", "comma-separated agents to enable: codex,claude")
    .option("-y, --yes", "use defaults for prompts")
    .option("--force", "overwrite existing PhaseHarness managed payload files")
    .action(async (options) => {
      const root = requireTargetRoot();
      requirePython();
      const installPath = resolve(root, ".phaseharness/install.json");
      const existing = readJson(installPath, {});
      if (existsSync(resolve(root, ".phaseharness")) && !existsSync(installPath) && !options.force) {
        throw new Error("Existing .phaseharness payload found. Re-run with --force to overwrite it.");
      }
      let agents = parseAgents(options.agents);
      if (!agents) {
        if (options.yes) {
          agents = enabledAgents(existing);
          if (!agents.length) agents = ["codex"];
        } else {
          agents = await checkbox({
            message: "Which agents should PhaseHarness integrate with?",
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
      const packageVersion = options.force || !existing.package_version ? context.packageVersion : existing.package_version;
      const install = buildInstallManifest({ packageVersion, agents, existing });
      writeJson(installPath, install);
      for (const agent of agents) {
        const args = ["install", "--provider", agent];
        runBridge(root, args);
      }
      if (result.skillsBackup) {
        console.log(`Existing PhaseHarness skills backed up to ${result.skillsBackup}.`);
      }
      console.log(`PhaseHarness installed for ${agents.join(", ")}.`);
    });
}

function enabledAgents(install) {
  if (!install.agents || typeof install.agents !== "object") return [];
  return AGENTS.filter((agent) => install.agents[agent]?.enabled);
}
