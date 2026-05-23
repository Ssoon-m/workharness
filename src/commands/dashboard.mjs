import { resolve } from "node:path";
import { requireGitRoot, requirePython, run } from "../lib/project.mjs";

function parsePort(value) {
  if (!/^\d+$/.test(value)) {
    throw new Error("port must be an integer between 0 and 65535");
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("port must be an integer between 0 and 65535");
  }
  return port;
}

export function registerDashboard(program) {
  program
    .command("dashboard")
    .description("Start the PhaseHarness dashboard for the current git project")
    .option("-p, --port <port>", "port to bind; defaults to 4673 with fallback to an available port", parsePort)
    .action((options) => {
      const root = requireGitRoot();
      requirePython();
      const dashboard = resolve(root, ".phaseharness/bin/phaseharness-dashboard.py");
      const args = [dashboard];
      if (options.port !== undefined) {
        args.push("--port", String(options.port));
      }
      const result = run("python3", args, { cwd: root, stdio: "inherit" });
      if (result.status !== 0) {
        throw new Error("phaseharness dashboard failed");
      }
    });
}
