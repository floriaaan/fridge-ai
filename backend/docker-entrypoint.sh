#!/bin/sh
set -e

# Match on the *last* argument rather than "$2": the server command now
# carries `--import ./instrumentation.ts` between `node` and the script.
for arg in "$@"; do
  last_arg="$arg"
done

if [ "$1" = "node" ] && [ "$last_arg" = "bin/server.js" ]; then
  echo "Running database migrations..."
  node bin/console.js migration:run --force
fi

exec "$@"
