#!/bin/bash
# ───────────────────────────────────────────────────────────────────
#  Studio S — pack the Claude connector as a Claude Desktop extension
#  Output: src-tauri/resources/studio-s.mcpb (bundled into the app so
#  "Set up the connector" can open it; also shipped on each release).
#  The extension is the connector plus the two app files it runs
#  (store.js, promptcompile.js), so it needs no repo checkout.
#  Runs automatically before `tauri dev` / `tauri build` (see
#  tauri.conf.json build.beforeBuildCommand). Invoke with `bash`.
# ───────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
OUT="${1:-src-tauri/resources/studio-s.mcpb}"

STAGE="$(mktemp -d)/studio-s"
mkdir -p "$STAGE/server/src"
cp connector/studio-s-mcp.cjs "$STAGE/server/index.js"
cp src/store.js src/promptcompile.js "$STAGE/server/src/"
cp src-tauri/icons/icon.png "$STAGE/icon.png"   # 512x512, the size Claude Desktop recommends
node -e "
const fs = require('fs');
const m = require('./connector/mcpb/manifest.json'); m.version = '$VERSION';
fs.writeFileSync('$STAGE/manifest.json', JSON.stringify(m, null, 2) + '\n');
fs.writeFileSync('$STAGE/package.json', JSON.stringify({ name: 'studio-s', version: '$VERSION', private: true }, null, 2) + '\n');
"

mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
npx --yes @anthropic-ai/mcpb pack "$STAGE" "$OUT" >/dev/null
rm -rf "$(dirname "$STAGE")"
echo "✅ connector packed: $OUT (v$VERSION)"
