# PhaseHarness

PhaseHarness is a workflow harness that helps AI coding agents handle large tasks in stages.

The workflow is:

```text
clarify -> context-gather -> plan -> generate -> evaluate
```

Each run's state and artifacts are stored under `.phaseharness/runs/<run-id>/`, and automatic workflows can continue through Codex or Claude Stop hooks.

## Supported Agents

- Claude Code
- Codex CLI

> When using Codex CLI, Codex may ask you to approve project hook execution. To keep PhaseHarness workflows moving correctly, make sure to approve the Stop hook in Codex. If you do not approve it, the workflow will not continue after certain stages. For details, see the [official Codex hooks documentation](https://developers.openai.com/codex/hooks).

## Install

Run PhaseHarness from the directory where you want to install it.

```bash
npm create phaseharness@latest
pnpm create phaseharness@latest
yarn create phaseharness@latest
```

The installer checks that the current directory is inside a git repository and that `python3` is available. In a monorepo, run the create command from the package or app directory that PhaseHarness should manage. It then asks which agent integrations to enable.

```text
[x] Codex
[ ] Claude
```

To install without prompts:

```bash
npm create phaseharness@latest -- --agents codex,claude
pnpm create phaseharness@latest --agents codex,claude
yarn create phaseharness@latest --agents codex,claude
```

## Agent Integrations

Agent selections are stored in:

```text
.phaseharness/install.json
```

The selected agents create the required hooks and skill directories.

- Codex: `.codex/config.toml`, `.codex/hooks.json`, `.codex/skills`
- Claude: `.claude/settings.json`, `.claude/skills`

`.phaseharness/skills` is the source of truth. Codex/Claude skill directories are generated output copied from this source. Symlinks are not used. After editing `.phaseharness/skills`, run `sync` explicitly to reflect those changes in Codex/Claude skills.

## Commands

| Purpose | npm | pnpm | Description |
| --- | --- | --- | --- |
| Add Agent | `npm run phaseharness:add-agent` | `pnpm run phaseharness:add-agent` | Choose supported agents from a checkbox prompt. |
| Add Agent Directly | `npm exec phaseharness -- add agent claude` | `pnpm exec phaseharness add agent claude` | Add a specific agent directly. Currently supports `codex` and `claude`. |
| Sync Skills | `npm run phaseharness:sync` | `pnpm run phaseharness:sync` | Reflect `.phaseharness/skills` source into Codex/Claude generated skills. |
| Check Status | `npm run phaseharness:doctor` | `pnpm run phaseharness:doctor` | Check install state and agent skill targets. |
| Dashboard | `npm run phaseharness:dashboard` | `pnpm run phaseharness:dashboard` | Open the dashboard on the default port `4673`. |
| Dashboard With Port | `npm exec phaseharness -- dashboard -p 6006` | `pnpm exec phaseharness dashboard -p 6006` | Open the dashboard on a specific port. |
| Update | `npx phaseharness@latest upgrade` | `pnpm dlx phaseharness@latest upgrade` | Update `.phaseharness` to the latest package payload. |

Before replacing `.phaseharness/skills`, `upgrade` backs up the current skill source to `.phaseharness/backups/skills-<timestamp>/`. PhaseHarness-managed files that no longer exist in the new package payload are removed.

`sync` does not download or replace the core `.phaseharness` payload. It overwrites enabled agent hooks and generated skill copies from the installed `.phaseharness/skills` source.

For yarn projects, run the same script names with yarn.

```bash
yarn phaseharness:add-agent
yarn phaseharness:dashboard
yarn phaseharness:sync
yarn phaseharness:doctor
```

## Quick Start

Ask the agent:

```text
Use `phaseharness` to implement <task>.
```

Before starting, choose:

- `loop count`: maximum number of `generate -> evaluate` retries when evaluate fails
- `commit mode`: `none`, `phase`, `final`

Defaults:

```text
loop count: 2
commit mode: none
```

## Dashboard

By default, the dashboard first tries `http://127.0.0.1:4673/` and falls back to an available port if 4673 is busy.

The dashboard shows the current active run, stage progress, artifacts, diagnostics, and run history.

## Project Guidance

If your project has architecture docs, coding rules, or review criteria, copy the example context file:

```bash
cp .phaseharness/context.example.json .phaseharness/context.json
```

Then edit `.phaseharness/context.json`.

- `context-gather.documents`: documents to reference before planning
- `context-gather.skills`: agent skills to consult for task-relevant conventions
- `evaluate.documents`: documents to reference during review
- `evaluate.skills`: agent skills to consult as review criteria
- `evaluate.rules`: additional review rules
