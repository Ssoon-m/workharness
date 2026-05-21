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

Run health checks:

```bash
npx phaseharness@latest doctor
pnpm dlx phaseharness@latest doctor
```
