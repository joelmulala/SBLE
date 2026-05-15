#!/usr/bin/env sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Building SBLE client (production)"
cd "$ROOT/client"
export GENERATE_SOURCEMAP=false
export CI=true
if [ -z "$REACT_APP_API_URL" ]; then
  export REACT_APP_API_URL=/api
fi
npm ci
npm run build

echo "==> Client build ready at client/build"
echo "    Serve with nginx (see DEPLOYMENT.md) or docker compose up --build"
