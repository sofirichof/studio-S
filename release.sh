#!/bin/bash
# ───────────────────────────────────────────────────────────────────
#  Studio S — one-command release builder
#  Builds + signs the auto-update artifacts and the DMG, then writes
#  latest.json. You upload the contents of release-vX.Y.Z/ to a GitHub
#  Release. The installed app reads latest.json and updates itself.
# ───────────────────────────────────────────────────────────────────
set -e

# ▼▼▼ EDIT THESE TWO if your GitHub repo is different ▼▼▼
OWNER="sofirichof"
REPO="studio-s"
# ▲▲▲ (must match the endpoint in src-tauri/tauri.conf.json) ▲▲▲

cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:$PATH"

KEY="src-tauri/.tauri-updater.key"
if [ ! -f "$KEY" ]; then echo "✗ Missing signing key at $KEY"; exit 1; fi
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""

VERSION=$(grep -m1 '"version"' src-tauri/tauri.conf.json | sed -E 's/.*"version"[ ]*:[ ]*"([^"]+)".*/\1/')
echo "▶ Building Studio S v$VERSION (signed) …"
npm run sync:build

B="src-tauri/target/release/bundle"
# Pick the freshest artifacts by mtime (-t), not alphabetically. Stale builds from a
# previous product name (e.g. "Studio S.app.tar.gz") can otherwise sort ahead of
# the just-built one and get published by mistake.
TARGZ=$(ls -t "$B/macos/"*.app.tar.gz 2>/dev/null | head -1)
SIG=$(ls -t "$B/macos/"*.app.tar.gz.sig 2>/dev/null | head -1)
DMG=$(ls -t "$B/dmg/"*.dmg 2>/dev/null | head -1)
if [ -z "$TARGZ" ] || [ -z "$SIG" ]; then echo "✗ No signed updater artifacts found — check the build log."; exit 1; fi

# GitHub replaces spaces with dots in release-asset URLs, so reference the dotted name.
ASSET=$(basename "$TARGZ" | sed 's/ /./g')

OUT="release-v$VERSION"
rm -rf "$OUT"; mkdir -p "$OUT"
cp "$TARGZ" "$OUT/"; cp "$SIG" "$OUT/"; cp "$DMG" "$OUT/"

cat > "$OUT/latest.json" <<EOF
{
  "version": "$VERSION",
  "notes": "Update to the latest Studio S.",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "darwin-aarch64": {
      "signature": "$(cat "$SIG")",
      "url": "https://github.com/$OWNER/$REPO/releases/download/v$VERSION/$ASSET"
    }
  }
}
EOF

echo ""
echo "✅ Release ready:  studio-s/$OUT/"
ls -1 "$OUT/"
echo ""
echo "Next: create a GitHub Release tagged  v$VERSION  (mark it 'Latest') and"
echo "upload ALL of the above files to it. The app will auto-update from there."
