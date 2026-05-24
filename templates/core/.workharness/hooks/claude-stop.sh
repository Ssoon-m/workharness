#!/usr/bin/env sh
set -eu

hook_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
root="$(dirname "$(dirname "$hook_dir")")"
exec python3 "$root/.workharness/bin/workharness-hook.py" --runtime claude --root "$root"
