import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { findInstallRoot, run } from "../lib/project.mjs";

export function registerDoctor(program) {
  program
    .command("doctor")
    .description("Inspect WorkHarness installation health")
    .option("--json", "print JSON only")
    .action((options) => {
      const root = findInstallRoot();
      const issues = [];
      if (run("python3", ["--version"]).status !== 0) {
        issues.push({ level: "error", message: "python3 is not available on PATH" });
      }
      if (!root) {
        issues.push({ level: "error", message: "missing .workharness/install.json at or above the current directory" });
      }
      if (!root || issues.some((issue) => issue.level === "error")) {
        const payload = { ok: false, issues };
        console.log(JSON.stringify(payload, null, 2));
        process.exitCode = 1;
        return;
      }
      if (!existsSync(resolve(root, ".workharness/install.json"))) {
        issues.push({ level: "error", message: "missing .workharness/install.json" });
      }
      if (!existsSync(resolve(root, ".workharness/bin/workharness-bridge.py"))) {
        issues.push({ level: "error", message: "missing .workharness/bin/workharness-bridge.py" });
      }
      if (issues.some((issue) => issue.level === "error")) {
        const payload = { ok: false, issues };
        console.log(JSON.stringify(payload, null, 2));
        process.exitCode = 1;
        return;
      }
      const bridge = resolve(root, ".workharness/bin/workharness-bridge.py");
      const result = run("python3", [bridge, "doctor"], { cwd: root });
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr && !options.json) process.stderr.write(result.stderr);
      if (result.status !== 0) {
        process.exitCode = 1;
      }
    });
}
