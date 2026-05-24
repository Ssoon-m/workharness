#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


CONFIG_WARNING_KEY = "__workharness_context_warning"


def find_project_root(start: Path | None = None) -> Path:
    current = (start or Path.cwd()).resolve()
    if current.is_file():
        current = current.parent
    while True:
        if (current / ".workharness").is_dir():
            return current
        if (current / ".git").exists():
            break
        if current == current.parent:
            break
        current = current.parent
    raise RuntimeError("could not find workharness root")


def load_config(root: Path) -> dict[str, Any] | None:
    path = root / ".workharness" / "context.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        return {CONFIG_WARNING_KEY: f"could not read .workharness/context.json: {exc}"}
    if not isinstance(data, dict):
        raise RuntimeError(".workharness/context.json must be a JSON object")
    return data


def doc_status(root: Path, item: dict[str, Any]) -> tuple[str, list[str]]:
    root_resolved = root.resolve()
    if "path" in item:
        path = (root / str(item["path"])).resolve()
        try:
            rel = path.relative_to(root_resolved)
        except ValueError:
            return "invalid", []
        if not path.exists():
            return "missing", []
        if not path.is_file():
            return "not_a_file", []
        try:
            with path.open("r", encoding="utf-8"):
                pass
        except OSError:
            return "unreadable", []
        return "exists", [str(rel)]
    if "glob" in item:
        pattern = str(item["glob"])
        if Path(pattern).is_absolute() or ".." in Path(pattern).parts:
            return "invalid", []
        try:
            paths = sorted(path for path in root.glob(pattern) if path.is_file())
            matches = [str(path.resolve().relative_to(root_resolved)) for path in paths]
        except (ValueError, NotImplementedError, OSError):
            return "invalid", []
        if not matches:
            return "no_matches", []
        return "matched", matches
    return "invalid", []


def render_doc(root: Path, item: Any) -> list[str]:
    if not isinstance(item, dict):
        return ["- invalid entry: not an object"]
    source_key = "path" if "path" in item else "glob" if "glob" in item else "source"
    source = str(item.get(source_key, ""))
    status, matches = doc_status(root, item)
    priority = item.get("priority", "unspecified")
    description = item.get("description", "")
    line = f"- `{source}` ({source_key}, {priority}, {status})"
    if description:
        line += f": {description}"
    lines = [line]
    if matches and source_key == "glob":
        shown = matches[:8]
        lines.append("  matches: " + ", ".join(f"`{match}`" for match in shown))
        if len(matches) > len(shown):
            lines.append(f"  more: {len(matches) - len(shown)}")
    return lines


def render_skill(item: Any) -> list[str]:
    if not isinstance(item, dict):
        return ["- invalid entry: not an object"]
    name = str(item.get("name", ""))
    if not name:
        return ["- invalid entry: missing name"]
    priority = item.get("priority", "unspecified")
    description = item.get("description", "")
    line = f"- `{name}` (skill, {priority}, configured)"
    if description:
        line += f": {description}"
    return [line]


def main() -> int:
    root = find_project_root(Path(__file__).parent)
    config = load_config(root)
    print("# Context-Gather Config")
    print()
    if config is None:
        print("No active `.workharness/context.json`.")
        return 0
    warning = config.get(CONFIG_WARNING_KEY)
    if isinstance(warning, str):
        print(f"Warning: {warning}")
        return 0
    context_gather = config.get("context-gather", {})
    docs = context_gather.get("documents", []) if isinstance(context_gather, dict) else []
    skills = context_gather.get("skills", []) if isinstance(context_gather, dict) else []
    has_docs = isinstance(docs, list) and bool(docs)
    has_skills = isinstance(skills, list) and bool(skills)
    if not has_docs and not has_skills:
        print("No configured context-gather documents or skills.")
        return 0
    if has_docs:
        print("## Documents")
        for item in docs:
            print("\n".join(render_doc(root, item)))
    if has_skills:
        if has_docs:
            print()
        print("## Skills")
        for item in skills:
            print("\n".join(render_skill(item)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
