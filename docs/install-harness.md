# Installing PhaseHarness

Install PhaseHarness in the target repository:

```bash
npx phaseharness@latest init
# or
pnpm dlx phaseharness@latest init
```

Choose Codex, Claude, or both when prompted.

Non-interactive examples:

```bash
npx phaseharness@latest init --agents codex
npx phaseharness@latest init --agents codex,claude
pnpm dlx phaseharness@latest init --agents codex
pnpm dlx phaseharness@latest init --agents codex,claude
```

Add another agent later:

```bash
npx phaseharness@latest add claude
pnpm dlx phaseharness@latest add claude
```

Update an existing install to the latest published package payload:

```bash
npx phaseharness@latest init -y --force
pnpm dlx phaseharness@latest init -y --force
```

Before replacing `.phaseharness/skills`, `init --force` backs up the current skill source to `.phaseharness/backups/skills-<timestamp>/`.

`sync` overwrites enabled agent hooks and generated skill copies from the installed `.phaseharness/skills` source. It does not download or replace the core `.phaseharness` payload.

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
```

By default the dashboard tries `http://127.0.0.1:4673/` and falls back to an available port if 4673 is busy.
