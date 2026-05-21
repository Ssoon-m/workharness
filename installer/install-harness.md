# install-harness

Legacy installer note.

PhaseHarness is now installed with the npm CLI:

```bash
npx phaseharness@latest init
# or
pnpm dlx phaseharness@latest init
```

For local development before publishing to npm, run from this repository:

```bash
pnpm cli init --agents codex
```

The installer copies the managed payload from:

```text
templates/core/.phaseharness/
```

The target project must be a git repository and must be able to run `python3`.
