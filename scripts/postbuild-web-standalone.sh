#!/usr/bin/env bash
# Copy Next.js static assets into standalone output (required for production).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/apps/web"
STANDALONE="$WEB/.next/standalone/apps/web"

if [ ! -d "$WEB/.next/static" ]; then
  echo "error: $WEB/.next/static not found — run next build first" >&2
  exit 1
fi

mkdir -p "$STANDALONE/.next"
cp -r "$WEB/.next/static" "$STANDALONE/.next/static"
if [ -d "$WEB/public" ]; then
  cp -r "$WEB/public" "$STANDALONE/public"
fi
echo "✓ Standalone static assets copied"
