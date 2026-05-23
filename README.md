# PhaseHarness

PhaseHarness is a staged workflow harness for AI coding agents.

It helps agents move through:

```text
clarify -> context-gather -> plan -> generate -> evaluate
```

The harness keeps durable run state under `.phaseharness/runs/<run-id>/`, records artifacts for each stage, and can resume automatic workflows through Codex or Claude session hooks.

## Install

Run PhaseHarness from the repository where you want to use it:

```bash
npx phaseharness@latest init
```

For pnpm users, the equivalent command is:

```bash
pnpm dlx phaseharness@latest init
```

The installer checks that the target is a git repository and that `python3` is available. It then asks which agents to integrate with:

```text
[x] Codex
[ ] Claude
```

You can also skip prompts:

```bash
npx phaseharness@latest init --agents codex,claude
# or
pnpm dlx phaseharness@latest init --agents codex,claude
```

## Agent Integrations

PhaseHarness stores the install choices in:

```text
.phaseharness/install.json
```

The selected agent integrations are reconciled on SessionStart:

- Codex: `.codex/config.toml`, `.codex/hooks.json`, `.codex/skills`
- Claude: `.claude/settings.json`, `.claude/skills`

`.phaseharness/skills` is the source of truth. Generated agent skill copies are updated from it by a provider-scoped SessionStart reconcile. Symlinks are not used.

To add another agent later:

```bash
npx phaseharness@latest add claude
# or
pnpm dlx phaseharness@latest add claude
```

To update an existing install to the latest published package payload:

```bash
npx phaseharness@latest init -y --force
# or
pnpm dlx phaseharness@latest init -y --force
```

To manually sync generated skill copies:

```bash
npx phaseharness@latest sync
```

`sync` does not download or replace the core `.phaseharness` payload. It only reconciles enabled agent hooks and generated skill copies from the installed `.phaseharness/skills` source.

If a generated agent skill copy was edited directly, sync reports a conflict and does not overwrite it by default. To overwrite generated copies intentionally:

```bash
npx phaseharness@latest sync --force
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

```text
Use `phaseharness-dashboard` to show the dashboard.
```

The dashboard shows the current active run, stage progress, generated outputs, diagnostics, and run history.

## Project Guidance

If your project has architecture docs, coding rules, or review criteria, copy the example context file:

```bash
cp .phaseharness/context.example.json .phaseharness/context.json
```

Then edit `.phaseharness/context.json`:

- `context-gather.documents`: documents used for planning context
- `evaluate.documents`: documents used during review
- `evaluate.rules`: additional review rules

## Commands

```bash
phaseharness init
phaseharness add codex
phaseharness add claude
phaseharness sync
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
