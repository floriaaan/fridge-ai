#!/usr/bin/env bash
# Copies every var backend/.env and root .env have in common into root .env
# (uncommenting it there if needed). Keeps root .env — Docker Compose's
# substitution file — in sync with backend/.env — AdonisJS's, the one
# usually hand-edited during dev — without touching vars that only exist on
# one side (POSTGRES_*/LANDING_*/OPENOBSERVE_* in root; DB_*/STORAGE_ROOT in
# backend).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f backend/.env ]; then
  echo "backend/.env missing — run 'task setup' first" >&2
  exit 1
fi
[ -f .env ] || cp .env.example .env

synced=0
while IFS= read -r line || [ -n "$line" ]; do
  key="${line%%=*}"
  value="${line#*=}"
  [ -z "$key" ] && continue
  case "$key" in \#*) continue ;; esac
  grep -q "^#\{0,1\}${key}=" .env || continue
  value_escaped=$(printf '%s' "$value" | sed -e 's/[\&|]/\\&/g')
  sed -i.bak "s|^#\{0,1\}${key}=.*|${key}=${value_escaped}|" .env
  synced=$((synced + 1))
done < backend/.env
rm -f .env.bak

echo "Synced $synced var(s) from backend/.env into .env"
