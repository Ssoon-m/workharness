# PhaseHarness

PhaseHarness is a staged workflow harness for AI coding agents.

It helps agents move through:

```text
clarify -> context-gather -> plan -> generate -> evaluate
```

The harness keeps durable run state under `.phaseharness/runs/<run-id>/`, records artifacts for each stage, and can resume automatic workflows through Codex or Claude session hooks.

## Install

Run PhaseHarness from the directory where you want to install it:

```bash
npm create phaseharness@latest
```

For pnpm or yarn users, the equivalent commands are:

```bash
pnpm create phaseharness@latest
yarn create phaseharness
```

The installer checks that the current directory is inside a git repository and that `python3` is available. In a monorepo, run the create command from the package or app directory you want PhaseHarness to manage. It then asks which agents to integrate with:

```text
[x] Codex
[ ] Claude
```

You can also skip prompts:

```bash
npm create phaseharness@latest -- --agents codex,claude
# or
pnpm create phaseharness@latest -- --agents codex,claude
```

## Agent Integrations

PhaseHarness stores the install choices in:

```text
.phaseharness/install.json
```

The selected agent integrations are reconciled on SessionStart:

- Codex: `.codex/config.toml`, `.codex/hooks.json`, `.codex/skills`
- Claude: `.claude/settings.json`, `.claude/skills`

`.phaseharness/skills` is the source of truth. Generated agent skill copies are overwritten from it by a provider-scoped SessionStart reconcile. Symlinks are not used.

To add another agent later:

```bash
npx phaseharness@latest add claude
# or
pnpm dlx phaseharness@latest add claude
```

To update an existing install to the latest published package payload:

```bash
npx phaseharness@latest upgrade
# or
pnpm dlx phaseharness@latest upgrade
```

Before replacing `.phaseharness/skills`, `upgrade` backs up the current skill source to `.phaseharness/backups/skills-<timestamp>/`.

To manually sync generated skill copies:

```bash
npx phaseharness@latest sync
```

`sync` does not download or replace the core `.phaseharness` payload. It overwrites enabled agent hooks and generated skill copies from the installed `.phaseharness/skills` source.

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

## Quick Start

Ask the agent to use PhaseHarness for a task:

```text
Use `phaseharness` to implement <task>.
```

Before starting, choose:

- `loop count`: maximum `generate -> evaluate` cycles when evaluation fails
- `commit mode`: `none`, `phase`, or `final`

Defaults:

```text
loop count: 2
commit mode: none
```

## Dashboard

Ask the agent:

```bash
npx phaseharness@latest dashboard
# or from package.json scripts
pnpm run phaseharness:dashboard
# or choose a port
npx phaseharness@latest dashboard -p 6006
```

By default the dashboard tries `http://127.0.0.1:4673/` and falls back to an available port if 4673 is busy.

The dashboard shows the current active run, stage progress, generated outputs, diagnostics, and run history.

## Project Guidance

If your project has architecture docs, coding rules, or review criteria, copy the example context file:

```bash
cp .phaseharness/context.example.json .phaseharness/context.json
```

Then edit `.phaseharness/context.json`:

- `context-gather.documents`: documents used for planning context
- `context-gather.skills`: agent skills to consult for task-relevant conventions
- `evaluate.documents`: documents used during review
- `evaluate.skills`: agent skills to consult for review criteria
- `evaluate.rules`: additional review rules

## Commands

```bash
phaseharness init
phaseharness upgrade
phaseharness add codex
phaseharness add claude
phaseharness sync
phaseharness dashboard
phaseharness doctor
```

## Development

This repository is a pnpm-managed npm package. Install dependencies and run checks with:

```bash
pnpm install
pnpm run check
pnpm run pack:dry
```

Installable PhaseHarness files live in:

```text
templates/core/.phaseharness/
```

The root repository should not track a live `.phaseharness/` install. Runtime state such as `.phaseharness/state` and `.phaseharness/runs` is created only inside target projects.
