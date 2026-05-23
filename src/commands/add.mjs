import { resolve } from "node:path";
import {
  AGENTS,
  buildInstallManifest,
  parseAgents,
  readJson,
  requireInstallRoot,
  requirePython,
  runBridge,
  writeJson
} from "../lib/project.mjs";

export function registerAdd(program, context) {
  program
    .command("add")
    .description("Add an agent integration to an existing PhaseHarness install")
    .argument("<agent>", "agent to add: codex or claude")
    .action((agent) => {
      const selectedAgents = parseAgents(agent);
      if (!selectedAgents || selectedAgents.length !== 1) {
        throw new Error(`Unknown agent: ${agent}`);
      }
      const [selected] = selectedAgents;
      const root = requireInstallRoot();
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
      runBridge(root, ["install", "--provider", selected]);
      console.log(`PhaseHarness ${selected} integration is installed.`);
    });
}
