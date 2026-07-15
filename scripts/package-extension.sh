#!/usr/bin/env bash
# Build and zip the Chrome extension for Web Store upload.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Building extension..."
pnpm --filter @fetcher/extension build

DIST="$ROOT/apps/extension/dist"
ZIP="$ROOT/apps/extension/fetcher-io-extension.zip"

rm -f "$ZIP"
(cd "$DIST" && zip -r "$ZIP" . -x "*.DS_Store")

echo "Created: $ZIP"
echo "Upload this zip in Chrome Web Store Developer Dashboard."
