import { requireInstallRoot, requirePython, runBridge } from "../lib/project.mjs";

export function registerSync(program) {
  program
    .command("sync")
    .description("Sync PhaseHarness skills into enabled agent skill directories")
    .option("--provider <provider>", "provider to sync: codex, claude, or all", "all")
    .action((options) => {
      const root = requireInstallRoot();
      requirePython();
      runBridge(root, [
        "reconcile",
        "--provider",
        options.provider,
        "--install-hooks"
      ]);
    });
}
