#!/bin/sh
set -e

host="${DB_HOST:-postgres}"
port="${DB_PORT:-5432}"
user="${DB_USER:-postgres}"

echo "Waiting for PostgreSQL at ${host}:${port}..."
until pg_isready -h "$host" -p "$port" -U "$user" >/dev/null 2>&1; do
  sleep 2
done
echo "PostgreSQL is ready."
