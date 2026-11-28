#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Hãy chạy script bên trong repository JX1-Remaster." >&2
  exit 1
}
ARCHIVE="${1:-}"
if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "Cách dùng: bash tools/import-jx1m-source.sh /duong-dan/JX1M-Clean-Source-Import.tar.gz" >&2
  exit 2
fi

EXPECTED_SHA="21e2f6d6df85fbc9e6932fc35772890db7a00e407d5b4f287c806a5cbc9761d6"
ACTUAL_SHA="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
if [[ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]]; then
  echo "SHA-256 không khớp. Dừng để tránh nhập nhầm gói." >&2
  echo "Expected: $EXPECTED_SHA" >&2
  echo "Actual:   $ACTUAL_SHA" >&2
  exit 3
fi

cd "$ROOT"
if [[ "$(git branch --show-current)" != "integration/jx1m-clean-monorepo" ]]; then
  echo "Đang ở branch khác. Hãy checkout integration/jx1m-clean-monorepo trước." >&2
  exit 4
fi
if [[ -e server/go.mod || -e server/main.go || -e client/cocos/package.json ]]; then
  echo "Đích nhập đã có source. Script không ghi đè; hãy rà soát và nhập thủ công." >&2
  exit 5
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# Reject absolute paths and parent traversal before extraction.
while IFS= read -r entry; do
  case "$entry" in
    /*|../*|*/../*|*/..)
      echo "Archive chứa đường dẫn không an toàn: $entry" >&2
      exit 6
      ;;
  esac
done < <(tar -tzf "$ARCHIVE")

tar -xzf "$ARCHIVE" -C "$TMP"
SRC="$TMP"
for f in main.go exp.go items.go level.go skills.go skill_combat.go world.go go.mod go.sum; do
  [[ -f "$SRC/$f" ]] || { echo "Thiếu tệp bắt buộc: $f" >&2; exit 7; }
done
[[ -d "$SRC/scripts" && -f "$SRC/scripts/smoke-test.sh" ]] || {
  echo "Thiếu scripts hoặc smoke-test.sh." >&2; exit 8;
}
[[ -d "$SRC/client-cocos/assets/Scripts" ]] || {
  echo "Thiếu Cocos TypeScript source." >&2; exit 9;
}

mkdir -p server/scripts client/cocos
cp "$SRC"/*.go "$SRC/go.mod" "$SRC/go.sum" server/
cp -a "$SRC/scripts/." server/scripts/
cp -a "$SRC/client-cocos/assets" "$SRC/client-cocos/package.json" "$SRC/client-cocos/tsconfig.json" client/cocos/
cp "$SRC/README_VI.md" server/UPSTREAM_README_VI.md
cp "$SRC/client-cocos/README_VI.md" client/cocos/UPSTREAM_README_VI.md

# Keep source formatting deterministic; never start the server or touch production data.
gofmt -w server/*.go
echo "Imported source files. Go requirement:"
grep '^go ' server/go.mod
echo "Next: run Go 1.26.0 checks and inspect git diff before committing."
