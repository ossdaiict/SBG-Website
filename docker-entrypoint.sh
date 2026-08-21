#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Running database migrations..."
  node /app/server/migrate.js
fi

exec node /app/server/dist/server.js
