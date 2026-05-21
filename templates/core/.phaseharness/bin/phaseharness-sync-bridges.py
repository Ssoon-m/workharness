#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Compatibility wrapper for Phaseharness bridge sync.")
    parser.add_argument("--runtime", choices=["all", "claude", "codex"], default="all")
    parser.add_argument("--skip-skills", action="store_true", help="retained for compatibility; ignored")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    bridge = Path(__file__).with_name("phaseharness-bridge.py")
    command = [sys.executable, str(bridge), "reconcile", "--provider", args.runtime]
    if args.quiet:
        command.append("--quiet")
    return subprocess.run(command).returncode


if __name__ == "__main__":
    raise SystemExit(main())
