#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json


def payload() -> dict[str, object]:
    return {
        "schema_version": 1,
        "status": "npm_managed",
        "message": "PhaseHarness template updates are managed by the npm CLI. Use npx phaseharness@latest init --force or npx phaseharness@latest sync.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Report PhaseHarness npm-managed update guidance.")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("check", "apply"):
        command = sub.add_parser(name)
        command.add_argument("--quiet", action="store_true")
        command.add_argument("--source")
        command.add_argument("--repo-url")
        command.add_argument("--ref")
        command.add_argument("--timeout-seconds")
        command.add_argument("--overwrite", action="append", default=[])
    args = parser.parse_args()
    if not args.quiet:
        print(json.dumps(payload(), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
