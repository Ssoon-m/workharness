import { checkbox } from "@inquirer/prompts";
import { resolve } from "node:path";
import {
  AGENTS,
  buildInstallManifest,
  ensureRuntimeState,
  installTemplate,
  parseAgents,
  readJson,
  requireGitRoot,
  requirePython,
  runBridge,
  writeJson
} from "../lib/project.mjs";

export function registerInit(program, context) {
  program
    .command("init")
    .description("Install PhaseHarness into the current git project")
    .option("--agents <agents>", "comma-separated agents to enable: codex,claude")
    .option("-y, --yes", "use defaults for prompts")
    .option("--force", "overwrite existing PhaseHarness managed payload files")
    .action(async (options) => {
      const root = requireGitRoot();
      requirePython();
      const existing = readJson(resolve(root, ".phaseharness/install.json"), {});
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
      installTemplate({ packageRoot: context.packageRoot, targetRoot: root, force: Boolean(options.force) });
      ensureRuntimeState(root);
      const install = buildInstallManifest({ packageVersion: context.packageVersion, agents, existing });
      writeJson(resolve(root, ".phaseharness/install.json"), install);
      for (const agent of agents) {
        const args = ["install", "--provider", agent];
        if (options.force) args.push("--force");
        runBridge(root, args);
      }
      console.log(`PhaseHarness installed for ${agents.join(", ")}.`);
    });
}

function enabledAgents(install) {
  if (!install.agents || typeof install.agents !== "object") return [];
  return AGENTS.filter((agent) => install.agents[agent]?.enabled);
}
