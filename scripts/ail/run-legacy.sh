#!/usr/bin/env bash
# Starts the existing Friendpod app for AIL's end-to-end checks (ail.config.json, run.legacy).
#
# The app ships for iOS and Android only, so on a machine without a simulator it runs as its web preview
# (apps/mobile/preview): the real screens against an in-memory fixture world. This builds the preview into
# .ail/legacy/build and serves it on 127.0.0.1:${AIL_APP_PORT:-8090}.
#
# Needs: `npm ci` at the repo root (README: Install).
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
build="$root/.ail/legacy/build"
port="${AIL_APP_PORT:-8090}"
if [ ! -d "$root/node_modules" ]; then
  echo "run-legacy: run 'npm ci' at the repository root first" >&2
  exit 1
fi
mkdir -p "$build"
cd "$root/apps/mobile"
node preview/shoot.mjs --build-only --build-dir "$build"
exec node preview/serve.mjs --build-dir "$build" --port "$port"
