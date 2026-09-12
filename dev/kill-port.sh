#!/usr/bin/env bash
# Frees a TCP port before starting a dev server on it.
#
# `node ace serve --hmr` never fails on a taken port — it silently falls
# back to a random one instead (@adonisjs/assembler's getPort() treats PORT
# as a preference for the `get-port` package, not a requirement). A backend
# left over from a killed pane/session (Ctrl+C that didn't reach the
# underlying hot-hook worker, a closed tmux pane, a crashed shell) then
# stays bound to 3333 forever, and the next `task dev:back` quietly starts
# on something like :55420 instead — same symptom as "serveur injoignable"
# on the mobile debug pill, with nothing in any log to explain it.
set -euo pipefail

port="${1:?usage: kill-port.sh <port>}"

pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
[ -z "$pids" ] && exit 0

echo "Port $port held by pid(s) $pids — killing before starting the dev server." >&2
# shellcheck disable=SC2086
kill $pids 2>/dev/null || true

# Give it a moment to actually release the socket before the caller binds
# to it — a killed process can take a beat to unwind (open DB connections,
# in-flight requests) even though the signal was delivered immediately.
for _ in $(seq 1 20); do
  lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || exit 0
  sleep 0.1
done

# Still there after 2s — try harder rather than let the caller silently
# drift to a random port.
# shellcheck disable=SC2086
kill -9 $pids 2>/dev/null || true
