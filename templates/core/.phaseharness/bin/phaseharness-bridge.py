#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import stat
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


AGENTS = ("codex", "claude")
SKILLS = [
    "clarify",
    "context-gather",
    "plan",
    "generate",
    "evaluate",
    "commit",
    "phaseharness",
    "phaseharness-dashboard",
]
DEFAULT_SKILL_TARGETS = {
    "codex": [".codex/skills"],
    "claude": [".claude/skills"],
}
LEGACY_CODEX_SKILL_TARGETS = [".agents/skills"]
INSTALL_PATH = Path(".phaseharness") / "install.json"
HOOK_MARKER = ".phaseharness"


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def find_project_root(start: Path | None = None) -> Path:
    current = (start or Path.cwd()).resolve()
    if current.is_file():
        current = current.parent
    while current != current.parent:
        if (current / ".phaseharness").is_dir() or (current / ".git").exists():
            return current
        current = current.parent
    raise RuntimeError("could not find project root")


def load_json_object(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"invalid JSON: {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise RuntimeError(f"expected JSON object: {path}")
    return data


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def default_install(package_version: str = "0.0.0") -> dict[str, Any]:
    return {
        "schema_version": 1,
        "package_version": package_version,
        "installed_at": now_iso(),
        "agents": {
            "codex": {"enabled": False, "skill_targets": DEFAULT_SKILL_TARGETS["codex"]},
            "claude": {"enabled": False, "skill_targets": DEFAULT_SKILL_TARGETS["claude"]},
        },
        "skill_sync": {
            "mode": "copy",
            "source": ".phaseharness/skills",
        },
    }


def normalize_install(data: dict[str, Any]) -> dict[str, Any]:
    install = default_install(str(data.get("package_version") or "0.0.0"))
    install.update({key: value for key, value in data.items() if key not in ("agents", "skill_sync")})
    agents = install["agents"]
    existing_agents = data.get("agents", {})
    if isinstance(existing_agents, dict):
        for agent in AGENTS:
            existing = existing_agents.get(agent, {})
            if isinstance(existing, dict):
                agents[agent].update(existing)
            agents[agent] = normalize_agent_config(agent, agents[agent])
    sync = install["skill_sync"]
    existing_sync = data.get("skill_sync", {})
    if isinstance(existing_sync, dict) and isinstance(existing_sync.get("source"), str):
        sync["source"] = existing_sync["source"]
    sync.setdefault("source", ".phaseharness/skills")
    return install


def normalize_agent_config(agent: str, config: dict[str, Any]) -> dict[str, Any]:
    if agent == "codex" and config.get("skill_targets") == LEGACY_CODEX_SKILL_TARGETS:
        config = dict(config)
        config["skill_targets"] = DEFAULT_SKILL_TARGETS["codex"]
    return config


def load_install(root: Path) -> dict[str, Any]:
    return normalize_install(load_json_object(root / INSTALL_PATH))


def make_executable(path: Path) -> None:
    if path.exists():
        path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def ensure_state_files(root: Path) -> list[Path]:
    changed: list[Path] = []
    state_dir = root / ".phaseharness" / "state"
    state_dir.mkdir(parents=True, exist_ok=True)
    active = state_dir / "active.json"
    if not active.exists():
        write_json(
            active,
            {
                "schema_version": 1,
                "active_run": None,
                "activation_source": None,
                "mode": None,
                "status": "inactive",
                "provider": None,
                "session_id": None,
                "bound_at": None,
                "bound_source": None,
                "worktree_root": None,
                "updated_at": now_iso(),
            },
        )
        changed.append(active)
    index = state_dir / "index.json"
    if not index.exists():
        write_json(index, {"schema_version": 1, "runs": []})
        changed.append(index)
    runs = root / ".phaseharness" / "runs"
    runs.mkdir(parents=True, exist_ok=True)
    keep = runs / ".gitkeep"
    if not keep.exists():
        keep.write_text("", encoding="utf-8")
        changed.append(keep)
    return changed


def command_for(runtime: str, event: str) -> str:
    script = f"{runtime}-{event}.sh"
    if runtime == "claude":
        return (
            "sh -c 'root=\"$(git -C \"${CLAUDE_PROJECT_DIR:-$PWD}\" rev-parse --show-toplevel 2>/dev/null || printf %s \"${CLAUDE_PROJECT_DIR:-$PWD}\")\"; "
            f"f=\"$root/.phaseharness/hooks/{script}\"; "
            "[ -x \"$f\" ] && exec \"$f\"; "
            "exit 0'"
        )
    if runtime == "codex":
        return (
            "sh -c 'root=\"$(git rev-parse --show-toplevel 2>/dev/null || pwd)\"; "
            f"f=\"$root/.phaseharness/hooks/{script}\"; "
            "[ -x \"$f\" ] && exec \"$f\"; "
            "exit 0'"
        )
    raise ValueError(runtime)


def hook_entry(runtime: str, event: str) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "type": "command",
        "command": command_for(runtime, event),
        "timeout": 30,
    }
    if runtime == "codex" and event == "stop":
        entry["statusMessage"] = "Checking phaseharness state"
    if runtime == "codex" and event == "session-start":
        entry["statusMessage"] = "Syncing phaseharness bridges"
    return entry


def command_is_phaseharness(value: Any) -> bool:
    return isinstance(value, dict) and HOOK_MARKER in str(value.get("command", ""))


def merge_hook(data: dict[str, Any], event: str, matcher: str, entry: dict[str, Any]) -> None:
    hooks_root = data.setdefault("hooks", {})
    if not isinstance(hooks_root, dict):
        raise RuntimeError("hooks must be an object")
    groups = hooks_root.setdefault(event, [])
    if not isinstance(groups, list):
        raise RuntimeError(f"hooks.{event} must be a list")
    target: dict[str, Any] | None = None
    for group in groups:
        if not isinstance(group, dict):
            continue
        existing = group.get("hooks", [])
        if isinstance(existing, list):
            existing[:] = [item for item in existing if not command_is_phaseharness(item)]
        if str(group.get("matcher", "")) == matcher:
            target = group
    if target is None:
        target = {"hooks": []}
        if matcher:
            target["matcher"] = matcher
        groups.append(target)
    entries = target.setdefault("hooks", [])
    if not isinstance(entries, list):
        raise RuntimeError(f"hooks.{event}[].hooks must be a list")
    entries.append(entry)


def ensure_codex_feature_flag(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    lines = text.splitlines()
    feature_header = re.compile(r"^\s*\[features\]\s*$")
    section_header = re.compile(r"^\s*\[[^\]]+\]\s*$")
    for index, line in enumerate(lines):
        if not feature_header.match(line):
            continue
        cursor = index + 1
        while cursor < len(lines) and not section_header.match(lines[cursor]):
            if re.match(r"^\s*hooks\s*=", lines[cursor]):
                lines[cursor] = "hooks = true"
                path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
                return
            cursor += 1
        lines.insert(index + 1, "hooks = true")
        path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
        return
    prefix = "\n\n" if text.strip() else ""
    path.write_text(text.rstrip() + f"{prefix}[features]\nhooks = true\n", encoding="utf-8")


def install_hooks(root: Path, provider: str) -> list[Path]:
    changed: list[Path] = []
    make_executable(root / ".phaseharness" / "hooks" / f"{provider}-stop.sh")
    make_executable(root / ".phaseharness" / "hooks" / f"{provider}-session-start.sh")
    if provider == "codex":
        config_path = root / ".codex" / "config.toml"
        hooks_path = root / ".codex" / "hooks.json"
        ensure_codex_feature_flag(config_path)
        data = load_json_object(hooks_path)
        merge_hook(data, "SessionStart", "startup|resume|clear", hook_entry("codex", "session-start"))
        merge_hook(data, "Stop", "", hook_entry("codex", "stop"))
        write_json(hooks_path, data)
        changed.extend([config_path, hooks_path])
    elif provider == "claude":
        path = root / ".claude" / "settings.json"
        data = load_json_object(path)
        merge_hook(data, "SessionStart", "startup|resume|clear|compact", hook_entry("claude", "session-start"))
        merge_hook(data, "Stop", "", hook_entry("claude", "stop"))
        write_json(path, data)
        changed.append(path)
    else:
        raise ValueError(provider)
    return changed


def discover_skill_dirs(root: Path, source_rel: str) -> list[Path]:
    skills_root = root / source_rel
    seen: set[str] = set()
    skill_dirs: list[Path] = []
    for skill_name in SKILLS:
        source = skills_root / skill_name
        if not source.exists():
            raise RuntimeError(f"missing skill: {source}")
        if not (source / "SKILL.md").is_file():
            raise RuntimeError(f"missing skill entrypoint: {source / 'SKILL.md'}")
        skill_dirs.append(source)
        seen.add(skill_name)
    for source in sorted(path for path in skills_root.iterdir() if path.is_dir()):
        if source.name in seen:
            continue
        if (source / "SKILL.md").is_file():
            skill_dirs.append(source)
    return skill_dirs


def copy_skill(source: Path, target: Path) -> Path:
    if target.exists():
        if target.is_dir() and not target.is_symlink():
            shutil.rmtree(target)
        else:
            target.unlink()
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, target)
    return target


def enabled_providers(install: dict[str, Any], provider: str) -> list[str]:
    agents = install.get("agents", {})
    requested = AGENTS if provider == "all" else (provider,)
    selected: list[str] = []
    for agent in requested:
        config = agents.get(agent, {}) if isinstance(agents, dict) else {}
        if isinstance(config, dict) and config.get("enabled"):
            selected.append(agent)
    return selected


def reconcile_provider(root: Path, install: dict[str, Any], provider: str, *, install_hooks_enabled: bool) -> dict[str, Any]:
    agent_config = install.get("agents", {}).get(provider, {})
    if not isinstance(agent_config, dict):
        agent_config = {}
    source_rel = str(install.get("skill_sync", {}).get("source") or ".phaseharness/skills")
    targets = agent_config.get("skill_targets") or DEFAULT_SKILL_TARGETS[provider]
    if not isinstance(targets, list) or not all(isinstance(item, str) for item in targets):
        raise RuntimeError(f"invalid skill_targets for {provider}")
    changed: list[str] = []
    if install_hooks_enabled:
        changed.extend(str(path.relative_to(root)) for path in install_hooks(root, provider))
    for source in discover_skill_dirs(root, source_rel):
        for target_root in targets:
            path = copy_skill(source, root / target_root / source.name)
            changed.append(str(path.relative_to(root)))
    return {"provider": provider, "changed": sorted(set(changed))}


def command_reconcile(args: argparse.Namespace) -> int:
    root = find_project_root()
    install = load_install(root)
    changed = [str(path.relative_to(root)) for path in ensure_state_files(root)]
    results = []
    for provider in enabled_providers(install, args.provider):
        result = reconcile_provider(root, install, provider, install_hooks_enabled=args.install_hooks)
        changed.extend(result["changed"])
        results.append(result)
    output = {"changed": sorted(set(changed)), "results": results}
    if not args.quiet:
        print(json.dumps(output, indent=2, ensure_ascii=False))
    return 0


def command_install(args: argparse.Namespace) -> int:
    root = find_project_root()
    install = load_install(root)
    agents = install.setdefault("agents", {})
    config = agents.setdefault(args.provider, {"skill_targets": DEFAULT_SKILL_TARGETS[args.provider]})
    if isinstance(config, dict):
        config["enabled"] = True
        config.setdefault("skill_targets", DEFAULT_SKILL_TARGETS[args.provider])
    write_json(root / INSTALL_PATH, install)
    ensure_state_files(root)
    result = reconcile_provider(root, install, args.provider, install_hooks_enabled=True)
    if not args.quiet:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


def command_doctor(args: argparse.Namespace) -> int:
    root = find_project_root()
    install = load_install(root)
    issues: list[dict[str, str]] = []
    if not (root / INSTALL_PATH).is_file():
        issues.append({"level": "error", "message": "missing .phaseharness/install.json"})
    for provider in enabled_providers(install, "all"):
        agent_config = install.get("agents", {}).get(provider, {})
        targets = agent_config.get("skill_targets") if isinstance(agent_config, dict) else None
        if not isinstance(targets, list) or not targets:
            issues.append({"level": "error", "message": f"{provider} has no skill targets"})
            continue
        for target in targets:
            path = root / str(target)
            if not path.exists():
                issues.append({"level": "warn", "message": f"missing skill target: {target}"})
    payload = {"ok": not any(issue["level"] == "error" for issue in issues), "issues": issues}
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0 if payload["ok"] else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage Phaseharness provider bridges.")
    sub = parser.add_subparsers(dest="command", required=True)

    install = sub.add_parser("install", help="enable and install one provider bridge")
    install.add_argument("--provider", choices=AGENTS, required=True)
    install.add_argument("--quiet", action="store_true")
    install.set_defaults(func=command_install)

    reconcile = sub.add_parser("reconcile", help="sync selected provider bridges from install.json")
    reconcile.add_argument("--provider", choices=("all", *AGENTS), default="all")
    reconcile.add_argument("--install-hooks", action="store_true")
    reconcile.add_argument("--quiet", action="store_true")
    reconcile.set_defaults(func=command_reconcile)

    doctor = sub.add_parser("doctor", help="inspect bridge installation state")
    doctor.set_defaults(func=command_doctor)

    args = parser.parse_args()
    try:
        return args.func(args)
    except Exception as exc:
        print(f"error: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
