# Installing PhaseHarness

Install PhaseHarness in the target directory:

```bash
npm create phaseharness@latest
# or
pnpm create phaseharness@latest
# or
yarn create phaseharness
```

Choose Codex, Claude, or both when prompted.

In a monorepo, run the create command from the package or app directory you want PhaseHarness to manage. PhaseHarness installs into the current directory, not the git top-level directory.

Non-interactive examples:

```bash
npm create phaseharness@latest -- --agents codex
npm create phaseharness@latest -- --agents codex,claude
pnpm create phaseharness@latest -- --agents codex
pnpm create phaseharness@latest -- --agents codex,claude
```

Add another agent later:

```bash
npx phaseharness@latest add claude
pnpm dlx phaseharness@latest add claude
```

Update an existing install to the latest published package payload:

```bash
npx phaseharness@latest upgrade
pnpm dlx phaseharness@latest upgrade
```

Before replacing `.phaseharness/skills`, `upgrade` backs up the current skill source to `.phaseharness/backups/skills-<timestamp>/`.

`sync` overwrites enabled agent hooks and generated skill copies from the installed `.phaseharness/skills` source. It does not download or replace the core `.phaseharness` payload.

If the target directory has `package.json`, `init` and `upgrade` add missing PhaseHarness scripts without overwriting existing script names:

```json
{
  "scripts": {
    "phaseharness:dashboard": "npx phaseharness@latest dashboard",
    "phaseharness:sync": "npx phaseharness@latest sync",
    "phaseharness:doctor": "npx phaseharness@latest doctor",
    "phaseharness:upgrade": "npx phaseharness@latest upgrade"
  }
}
```

Run health checks:

```bash
npx phaseharness@latest doctor
pnpm dlx phaseharness@latest doctor
```

Start the dashboard:

```bash
npx phaseharness@latest dashboard
npx phaseharness@latest dashboard -p 6006
pnpm dlx phaseharness@latest dashboard
pnpm run phaseharness:dashboard
```

By default the dashboard tries `http://127.0.0.1:4673/` and falls back to an available port if 4673 is busy.
