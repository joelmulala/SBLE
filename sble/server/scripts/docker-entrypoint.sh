#!/bin/sh
set -e

if [ -f /app/scripts/wait-for-postgres.sh ]; then
  /app/scripts/wait-for-postgres.sh
fi

exec "$@"
