import { requireGitRoot, requirePython, runBridge } from "../lib/project.mjs";

export function registerSync(program) {
  program
    .command("sync")
    .description("Sync PhaseHarness skills into enabled agent skill directories")
    .option("--provider <provider>", "provider to sync: codex, claude, or all", "all")
    .option("--force", "overwrite managed generated skill copies")
    .action((options) => {
      const root = requireGitRoot();
      requirePython();
      runBridge(root, [
        "reconcile",
        "--provider",
        options.provider,
        ...(options.force ? ["--force"] : []),
        "--install-hooks"
      ]);
    });
}
