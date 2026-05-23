import { checkbox } from "@inquirer/prompts";
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
  const add = program
    .command("add")
    .description("Add PhaseHarness resources to an existing install")
    .allowExcessArguments(false)
    .action(() => {
      add.help();
    });

  add
    .command("agent")
    .description("Add an agent integration to an existing PhaseHarness install")
    .argument("[agent]", "agent to add: codex, claude, or comma-separated values")
    .action(async (agent) => {
      await addAgents({ agent, context });
    });
}

async function addAgents({ agent, context }) {
  const root = requireInstallRoot();
  requirePython();
  const installPath = resolve(root, ".phaseharness/install.json");
  const existing = readJson(installPath, null);
  if (!existing) {
    throw new Error("PhaseHarness is not installed. Run phaseharness init first.");
  }
  const currentlyEnabled = AGENTS.filter((item) => existing.agents?.[item]?.enabled);
  if (!agent && currentlyEnabled.length === AGENTS.length) {
    console.log("All supported PhaseHarness agent integrations are already installed.");
    return;
  }
  const selectedAgents = agent
    ? parseSelectedAgents(agent)
    : await promptAgents(currentlyEnabled);
  const agentsToInstall = selectedAgents.filter((item) => !currentlyEnabled.includes(item));
  if (!agentsToInstall.length) {
    console.log("All selected PhaseHarness agent integrations are already installed.");
    return;
  }
  const install = buildInstallManifest({
    packageVersion: context.packageVersion,
    agents: [...new Set([...currentlyEnabled, ...agentsToInstall])],
    existing
  });
  writeJson(installPath, install);
  for (const selected of agentsToInstall) {
    runBridge(root, ["install", "--provider", selected]);
  }
  console.log(`PhaseHarness agent integration installed: ${agentsToInstall.join(", ")}.`);
}

function parseSelectedAgents(value) {
  const selectedAgents = parseAgents(value);
  if (!selectedAgents?.length) {
    throw new Error(`Unknown agent: ${value}`);
  }
  return selectedAgents;
}

async function promptAgents(currentlyEnabled) {
  const choices = AGENTS.map((agent) => ({
    name: agent === "codex" ? "Codex" : "Claude",
    value: agent,
    disabled: currentlyEnabled.includes(agent) ? "already installed" : false
  }));
  const selected = await checkbox({
    message: "Which agents should PhaseHarness add?",
    choices,
    required: true
  });
  return selected;
}
