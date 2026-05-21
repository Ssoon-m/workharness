import { resolve } from "node:path";
import {
  AGENTS,
  buildInstallManifest,
  parseAgents,
  readJson,
  requireGitRoot,
  requirePython,
  runBridge,
  writeJson
} from "../lib/project.mjs";

export function registerAdd(program, context) {
  program
    .command("add")
    .description("Add an agent integration to an existing PhaseHarness install")
    .argument("<agent>", "agent to add: codex or claude")
    .option("--force", "overwrite managed generated skill copies")
    .action((agent, options) => {
      const selectedAgents = parseAgents(agent);
      if (!selectedAgents || selectedAgents.length !== 1) {
        throw new Error(`Unknown agent: ${agent}`);
      }
      const [selected] = selectedAgents;
      const root = requireGitRoot();
      requirePython();
      const installPath = resolve(root, ".phaseharness/install.json");
      const existing = readJson(installPath, null);
      if (!existing) {
        throw new Error("PhaseHarness is not installed. Run phaseharness init first.");
      }
      const currentlyEnabled = AGENTS.filter((item) => existing.agents?.[item]?.enabled);
      const install = buildInstallManifest({
        packageVersion: context.packageVersion,
        agents: [...new Set([...currentlyEnabled, selected])],
        existing
      });
      writeJson(installPath, install);
      runBridge(root, ["install", "--provider", selected, ...(options.force ? ["--force"] : [])]);
      console.log(`PhaseHarness ${selected} integration is installed.`);
    });
}
