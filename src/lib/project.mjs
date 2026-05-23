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
const PACKAGE_SCRIPT_DEFINITIONS = {
  "phaseharness:add-agent": {
    current: "phaseharness add agent",
    managed: [
      "phaseharness add agent"
    ]
  },
  "phaseharness:dashboard": {
    current: "phaseharness dashboard",
    managed: [
      "phaseharness dashboard",
      "npx phaseharness@latest dashboard"
    ]
  },
  "phaseharness:sync": {
    current: "phaseharness sync",
    managed: [
      "phaseharness sync",
      "npx phaseharness@latest sync"
    ]
  },
  "phaseharness:doctor": {
    current: "phaseharness doctor",
    managed: [
      "phaseharness doctor",
      "npx phaseharness@latest doctor"
    ]
  }
};
const REMOVED_PACKAGE_SCRIPTS = {
  "phaseharness:add": [
    "phaseharness add"
  ],
  "phaseharness:upgrade": [
    "npx phaseharness@latest upgrade",
    "phaseharness upgrade"
  ]
};
export const PACKAGE_SCRIPTS = {
  "phaseharness:add-agent": PACKAGE_SCRIPT_DEFINITIONS["phaseharness:add-agent"].current,
  "phaseharness:dashboard": PACKAGE_SCRIPT_DEFINITIONS["phaseharness:dashboard"].current,
  "phaseharness:sync": PACKAGE_SCRIPT_DEFINITIONS["phaseharness:sync"].current,
  "phaseharness:doctor": PACKAGE_SCRIPT_DEFINITIONS["phaseharness:doctor"].current
};
const MANAGED_TEMPLATE_DIRS = [
  ".phaseharness/bin",
  ".phaseharness/hooks",
  ".phaseharness/prompts"
];
const MANAGED_TEMPLATE_FILES = [
  ".phaseharness/.gitignore",
  ".phaseharness/context.example.json",
  ".phaseharness/context.schema.json",
  ".phaseharness/settings.example.json"
];

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

export function ensurePackageScripts(root, { packageVersion } = {}) {
  const packageJsonPath = resolve(root, "package.json");
  if (!existsSync(packageJsonPath)) {
    return { status: "missing", changed: [], removed: [], dependencyChanged: false };
  }
  const pkg = readJson(packageJsonPath, null);
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
    throw new Error("package.json must contain a JSON object.");
  }
  if (!pkg.scripts || typeof pkg.scripts !== "object" || Array.isArray(pkg.scripts)) {
    pkg.scripts = {};
  }
  const changed = [];
  const removed = [];
  for (const [name, definition] of Object.entries(PACKAGE_SCRIPT_DEFINITIONS)) {
    if (Object.hasOwn(pkg.scripts, name) && !definition.managed.includes(pkg.scripts[name])) {
      continue;
    }
    if (pkg.scripts[name] === definition.current) {
      continue;
    }
    pkg.scripts[name] = definition.current;
    changed.push(name);
  }
  for (const [name, managedCommands] of Object.entries(REMOVED_PACKAGE_SCRIPTS)) {
    if (managedCommands.includes(pkg.scripts[name])) {
      delete pkg.scripts[name];
      removed.push(name);
    }
  }
  const dependencyChanged = packageVersion
    ? ensurePhaseHarnessDevDependency(pkg, packageVersion)
    : false;
  if (changed.length || removed.length || dependencyChanged) {
    writeJson(packageJsonPath, pkg);
  }
  return { status: "ok", changed, removed, dependencyChanged };
}

function ensurePhaseHarnessDevDependency(pkg, packageVersion) {
  let changed = false;
  if (!pkg.devDependencies || typeof pkg.devDependencies !== "object" || Array.isArray(pkg.devDependencies)) {
    pkg.devDependencies = {};
    changed = true;
  }
  if (pkg.devDependencies.phaseharness !== packageVersion) {
    pkg.devDependencies.phaseharness = packageVersion;
    changed = true;
  }
  if (pkg.dependencies && typeof pkg.dependencies === "object" && !Array.isArray(pkg.dependencies) && Object.hasOwn(pkg.dependencies, "phaseharness")) {
    delete pkg.dependencies.phaseharness;
    changed = true;
  }
  return changed;
}

export function installPackageDependencies(root, packageSetup, { enabled = true } = {}) {
  if (packageSetup.status === "missing" || !packageSetup.dependencyChanged) {
    return { status: packageSetup.status === "missing" ? "missing" : "unchanged" };
  }
  if (!enabled) {
    return { status: "skipped", manager: detectPackageManager(root) };
  }
  const manager = detectPackageManager(root);
  const args = manager === "bun" ? ["install"] : ["install"];
  const result = run(manager, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${manager} install failed. Re-run with --no-install to update PhaseHarness files without installing package dependencies.`);
  }
  return { status: "installed", manager };
}

export function detectPackageManager(root) {
  let current = resolve(root);
  while (true) {
    const packageJsonPath = resolve(current, "package.json");
    const pkg = readJson(packageJsonPath, {});
    const declared = typeof pkg.packageManager === "string" ? pkg.packageManager.split("@")[0] : null;
    if (["npm", "pnpm", "yarn", "bun"].includes(declared)) {
      return declared;
    }
    if (existsSync(resolve(current, "pnpm-lock.yaml"))) return "pnpm";
    if (existsSync(resolve(current, "yarn.lock"))) return "yarn";
    if (existsSync(resolve(current, "bun.lockb")) || existsSync(resolve(current, "bun.lock"))) return "bun";
    if (existsSync(resolve(current, "package-lock.json"))) return "npm";
    if (isGitBoundary(current)) {
      break;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  const userAgent = process.env.npm_config_user_agent || "";
  const match = userAgent.match(/^(npm|pnpm|yarn|bun)\//);
  return match?.[1] ?? "npm";
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
  if (force) {
    pruneManagedTemplatePayload({ packageRoot, targetRoot });
  }
  copyDirectory(source, targetRoot, { force });
  normalizeTemplateGitignore(targetRoot);
  for (const file of [
    ".phaseharness/bin/phaseharness-bridge.py",
    ".phaseharness/bin/phaseharness-state.py",
    ".phaseharness/bin/phaseharness-hook.py",
    ".phaseharness/bin/phaseharness-dashboard.py",
    ".phaseharness/bin/phaseharness-worktree.py",
    ".phaseharness/hooks/codex-stop.sh",
    ".phaseharness/hooks/claude-stop.sh"
  ]) {
    ensureExecutable(resolve(targetRoot, file));
  }
  return { skillsBackup };
}

function pruneManagedTemplatePayload({ packageRoot, targetRoot }) {
  const source = resolve(packageRoot, "templates/core");
  for (const dir of MANAGED_TEMPLATE_DIRS) {
    pruneDirectory(resolve(source, dir), resolve(targetRoot, dir));
  }
  for (const file of MANAGED_TEMPLATE_FILES) {
    const sourcePath = resolve(source, file);
    const targetPath = resolve(targetRoot, file);
    if (!existsSync(sourcePath) && existsSync(targetPath) && statSync(targetPath).isFile()) {
      rmSync(targetPath);
    }
  }
}

function pruneDirectory(source, target) {
  if (!existsSync(target) || !statSync(target).isDirectory()) {
    return;
  }
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    rmSync(target, { recursive: true, force: true });
    return;
  }
  for (const entry of readdirSync(target)) {
    const sourcePath = resolve(source, entry);
    const targetPath = resolve(target, entry);
    const targetStat = statSync(targetPath);
    if (!existsSync(sourcePath)) {
      rmSync(targetPath, { recursive: targetStat.isDirectory(), force: true });
      continue;
    }
    const sourceStat = statSync(sourcePath);
    if (targetStat.isDirectory() && sourceStat.isDirectory()) {
      pruneDirectory(sourcePath, targetPath);
    }
  }
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
