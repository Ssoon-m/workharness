import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const AGENTS = ["codex", "claude"];
export const DEFAULT_SKILL_TARGETS = {
  codex: [".agents/skills"],
  claude: [".claude/skills"]
};

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

export function requireGitRoot(cwd = process.cwd()) {
  const result = run("git", ["rev-parse", "--show-toplevel"], { cwd });
  if (result.status !== 0) {
    throw new Error("PhaseHarness must be installed from inside a git repository.");
  }
  return result.stdout.trim();
}

export function requirePython() {
  const result = run("python3", ["--version"]);
  if (result.status !== 0) {
    throw new Error("PhaseHarness requires python3 on PATH.");
  }
}

export function parseAgents(value) {
  if (!value) return null;
  const agents = value.split(",").map((item) => item.trim()).filter(Boolean);
  const invalid = agents.filter((agent) => !AGENTS.includes(agent));
  if (invalid.length) {
    throw new Error(`Unknown agent(s): ${invalid.join(", ")}`);
  }
  return [...new Set(agents)];
}

export function readJson(path, fallback = {}) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function copyDirectory(source, target, { force = false } = {}) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source)) {
    const from = join(source, entry);
    const to = join(target, entry);
    const stat = statSync(from);
    if (stat.isDirectory()) {
      copyDirectory(from, to, { force });
      continue;
    }
    if (existsSync(to) && !force) {
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { force: true });
  }
}

export function ensureExecutable(path) {
  if (existsSync(path)) {
    chmodSync(path, statSync(path).mode | 0o755);
  }
}

export function ensureRuntimeState(root) {
  const stateDir = resolve(root, ".phaseharness/state");
  mkdirSync(stateDir, { recursive: true });
  const active = resolve(stateDir, "active.json");
  if (!existsSync(active)) {
    writeJson(active, {
      schema_version: 1,
      active_run: null,
      activation_source: null,
      mode: null,
      status: "inactive",
      provider: null,
      session_id: null,
      bound_at: null,
      bound_source: null,
      worktree_root: null
    });
  }
  const index = resolve(stateDir, "index.json");
  if (!existsSync(index)) {
    writeJson(index, { schema_version: 1, runs: [] });
  }
  const runs = resolve(root, ".phaseharness/runs");
  mkdirSync(runs, { recursive: true });
  const keep = resolve(runs, ".gitkeep");
  if (!existsSync(keep)) {
    writeFileSync(keep, "");
  }
}

export function buildInstallManifest({ packageVersion, agents, existing = {} }) {
  const next = {
    schema_version: 1,
    package_version: packageVersion,
    installed_at: existing.installed_at ?? new Date().toISOString(),
    agents: {
      codex: {
        enabled: false,
        skill_targets: DEFAULT_SKILL_TARGETS.codex
      },
      claude: {
        enabled: false,
        skill_targets: DEFAULT_SKILL_TARGETS.claude
      }
    },
    skill_sync: {
      mode: "copy",
      source: ".phaseharness/skills",
      managed_marker: ".phaseharness-managed.json"
    }
  };
  if (existing.agents && typeof existing.agents === "object") {
    for (const agent of AGENTS) {
      if (existing.agents[agent] && typeof existing.agents[agent] === "object") {
        next.agents[agent] = { ...next.agents[agent], ...existing.agents[agent] };
      }
    }
  }
  if (existing.skill_sync && typeof existing.skill_sync === "object") {
    next.skill_sync = { ...next.skill_sync, ...existing.skill_sync, mode: "copy" };
  }
  for (const agent of agents) {
    next.agents[agent].enabled = true;
  }
  return next;
}

export function runBridge(root, args, { stdio = "inherit" } = {}) {
  const bridge = resolve(root, ".phaseharness/bin/phaseharness-bridge.py");
  const result = run("python3", [bridge, ...args], { cwd: root, stdio });
  if (result.status !== 0) {
    throw new Error(`phaseharness bridge failed: ${args.join(" ")}`);
  }
  return result;
}

export function installTemplate({ packageRoot, targetRoot, force }) {
  const source = resolve(packageRoot, "templates/core");
  copyDirectory(source, targetRoot, { force });
  for (const file of [
    ".phaseharness/bin/phaseharness-bridge.py",
    ".phaseharness/bin/phaseharness-sync-bridges.py",
    ".phaseharness/bin/phaseharness-state.py",
    ".phaseharness/bin/phaseharness-hook.py",
    ".phaseharness/bin/phaseharness-update.py",
    ".phaseharness/bin/phaseharness-worktree.py",
    ".phaseharness/hooks/codex-session-start.sh",
    ".phaseharness/hooks/codex-stop.sh",
    ".phaseharness/hooks/claude-session-start.sh",
    ".phaseharness/hooks/claude-stop.sh"
  ]) {
    ensureExecutable(resolve(targetRoot, file));
  }
}
