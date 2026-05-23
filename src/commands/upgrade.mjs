import { resolve } from "node:path";
import {
  buildInstallManifest,
  enabledAgents,
  installPackageDependencies,
  ensurePackageScripts,
  ensureRuntimeState,
  installTemplate,
  readJson,
  requireInstallRoot,
  requirePython,
  runBridge,
  writeJson
} from "../lib/project.mjs";

export function registerUpgrade(program, context) {
  program
    .command("upgrade")
    .description("Upgrade the nearest PhaseHarness install to this package payload")
    .option("--no-install", "skip package manager install after updating package.json")
    .action((options) => {
      const root = requireInstallRoot();
      requirePython();
      const installPath = resolve(root, ".phaseharness/install.json");
      const existing = readJson(installPath, null);
      if (!existing) {
        throw new Error("PhaseHarness is not installed. Run phaseharness init first.");
      }
      const agents = enabledAgents(existing);
      const result = installTemplate({ packageRoot: context.packageRoot, targetRoot: root, force: true });
      ensureRuntimeState(root);
      const packageScripts = ensurePackageScripts(root, { packageVersion: context.packageVersion });
      const packageInstall = installPackageDependencies(root, packageScripts, { enabled: options.install !== false });
      const install = buildInstallManifest({
        packageVersion: context.packageVersion,
        agents,
        existing
      });
      writeJson(installPath, install);
      runBridge(root, ["reconcile", "--provider", "all", "--install-hooks"]);
      if (result.skillsBackup) {
        console.log(`Existing PhaseHarness skills backed up to ${result.skillsBackup}.`);
      }
      logPackageScripts(packageScripts);
      logPackageInstall(packageInstall);
      console.log(`PhaseHarness upgraded from ${existing.package_version ?? "unknown"} to ${context.packageVersion}.`);
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
    console.log("Pinned phaseharness in devDependencies.");
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
