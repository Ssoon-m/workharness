#!/usr/bin/env sh
set -eu

hook_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
root="$(dirname "$(dirname "$hook_dir")")"
log_dir="$root/.phaseharness/state/logs"
mkdir -p "$log_dir"
python3 "$root/.phaseharness/bin/phaseharness-bridge.py" reconcile --provider codex --quiet >"$log_dir/session-start-sync.log" 2>&1 || true
