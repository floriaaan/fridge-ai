#!/bin/sh
set -e

if [ "$1" = "node" ] && [ "$2" = "bin/server.js" ]; then
  echo "Running database migrations..."
  node bin/console.js migration:run --force
fi

exec "$@"
