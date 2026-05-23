import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";

export const AGENTS = ["codex", "claude"];
export const DEFAULT_SKILL_TARGETS = {
  codex: [".codex/skills"],
  claude: [".claude/skills"]
};
export const PACKAGE_SCRIPTS = {
  "phaseharness:dashboard": "npx phaseharness@latest dashboard",
  "phaseharness:sync": "npx phaseharness@latest sync",
  "phaseharness:doctor": "npx phaseharness@latest doctor",
  "phaseharness:upgrade": "npx phaseharness@latest upgrade"
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

export function requireGitRepository(cwd = process.cwd()) {
  const result = run("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
  if (result.status !== 0 || result.stdout.trim() !== "true") {
    throw new Error("PhaseHarness must be initialized from inside a git repository.");
  }
}

export function requireTargetRoot(cwd = process.cwd()) {
  requireGitRepository(cwd);
  return resolve(cwd);
}

export function findInstallRoot(cwd = process.cwd()) {
  let current = resolve(cwd);
  if (existsSync(current) && statSync(current).isFile()) {
    current = dirname(current);
  }
  while (true) {
    if (existsSync(resolve(current, ".phaseharness/install.json"))) {
      return current;
    }
    if (isGitBoundary(current)) {
      return null;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function requireInstallRoot(cwd = process.cwd()) {
  const root = findInstallRoot(cwd);
  if (!root) {
    throw new Error("PhaseHarness is not installed at or above the current directory. Run phaseharness init from the target project directory.");
  }
  return root;
}

function isGitBoundary(path) {
  return existsSync(resolve(path, ".git"));
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

export function ensurePackageScripts(root) {
  const packageJsonPath = resolve(root, "package.json");
  if (!existsSync(packageJsonPath)) {
    return { status: "missing", changed: [] };
  }
  const pkg = readJson(packageJsonPath, null);
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
    throw new Error("package.json must contain a JSON object.");
  }
  if (!pkg.scripts || typeof pkg.scripts !== "object" || Array.isArray(pkg.scripts)) {
    pkg.scripts = {};
  }
  const changed = [];
  for (const [name, command] of Object.entries(PACKAGE_SCRIPTS)) {
    if (Object.hasOwn(pkg.scripts, name)) {
      continue;
    }
    pkg.scripts[name] = command;
    changed.push(name);
  }
  if (changed.length) {
    writeJson(packageJsonPath, pkg);
  }
  return { status: "ok", changed };
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
      source: ".phaseharness/skills"
    }
  };
  if (existing.agents && typeof existing.agents === "object") {
    for (const agent of AGENTS) {
      if (existing.agents[agent] && typeof existing.agents[agent] === "object") {
        next.agents[agent] = { ...next.agents[agent], ...existing.agents[agent] };
      }
    }
  }
  for (const agent of agents) {
    next.agents[agent].enabled = true;
  }
  return next;
}

export function enabledAgents(install) {
  if (!install.agents || typeof install.agents !== "object") return [];
  return AGENTS.filter((agent) => install.agents[agent]?.enabled);
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
  const skillsBackup = force ? backupSkillsBeforeOverwrite(targetRoot) : null;
  copyDirectory(source, targetRoot, { force });
  normalizeTemplateGitignore(targetRoot);
  for (const file of [
    ".phaseharness/bin/phaseharness-bridge.py",
    ".phaseharness/bin/phaseharness-sync-bridges.py",
    ".phaseharness/bin/phaseharness-state.py",
    ".phaseharness/bin/phaseharness-hook.py",
    ".phaseharness/bin/phaseharness-dashboard.py",
    ".phaseharness/bin/phaseharness-worktree.py",
    ".phaseharness/hooks/codex-session-start.sh",
    ".phaseharness/hooks/codex-stop.sh",
    ".phaseharness/hooks/claude-session-start.sh",
    ".phaseharness/hooks/claude-stop.sh"
  ]) {
    ensureExecutable(resolve(targetRoot, file));
  }
  return { skillsBackup };
}

function backupSkillsBeforeOverwrite(targetRoot) {
  const skillsPath = resolve(targetRoot, ".phaseharness/skills");
  if (!existsSync(skillsPath) || !statSync(skillsPath).isDirectory()) {
    return null;
  }
  const backupsRoot = resolve(targetRoot, ".phaseharness/backups");
  mkdirSync(backupsRoot, { recursive: true });
  const baseName = `skills-${formatBackupTimestamp(new Date())}`;
  let name = baseName;
  let suffix = 2;
  while (existsSync(resolve(backupsRoot, name))) {
    name = `${baseName}-${suffix}`;
    suffix += 1;
  }
  const backupPath = resolve(backupsRoot, name);
  cpSync(skillsPath, backupPath, { recursive: true });
  rmSync(skillsPath, { force: true, recursive: true });
  return `.phaseharness/backups/${name}`;
}

function formatBackupTimestamp(date) {
  const pad = (value, size = 2) => String(value).padStart(size, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + "-" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("") + `-${pad(date.getMilliseconds(), 3)}`;
}

function normalizeTemplateGitignore(targetRoot) {
  const npmIgnore = resolve(targetRoot, ".phaseharness/.npmignore");
  const gitIgnore = resolve(targetRoot, ".phaseharness/.gitignore");
  if (!existsSync(npmIgnore)) return;
  if (!existsSync(gitIgnore)) {
    renameSync(npmIgnore, gitIgnore);
    return;
  }
  rmSync(npmIgnore);
}
