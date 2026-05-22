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

`sync` only reconciles enabled agent hooks and generated skill copies from the installed `.phaseharness/skills` source.

Run health checks:

```bash
npx phaseharness@latest doctor
pnpm dlx phaseharness@latest doctor
```
