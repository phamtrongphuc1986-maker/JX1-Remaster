#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8083}"
TEST_USER="${TEST_USER:-jxsmoke$(date +%s)}"
TEST_PASS="${TEST_PASS:-TestPass123!}"

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }

request() {
  curl --fail --silent --show-error -H 'Content-Type: application/json' "$@"
}

request -X POST "$BASE_URL/api/register" \
  -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" >/dev/null

LOGIN="$(request -X POST "$BASE_URL/api/login" \
  -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")"
TOKEN="$(printf '%s' "$LOGIN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"
AUTH=(-H "Authorization: Bearer $TOKEN")

CLASSES="$(request "${AUTH[@]}" "$BASE_URL/api/classes")"
printf '%s' "$CLASSES" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("count", len(d.get("classes", []))) == 10; print("PASS: classes")'

CHAR="$(request "${AUTH[@]}" -X POST "$BASE_URL/api/characters/create" \
  -d "{\"name\":\"Smoke$(date +%s)\",\"class_id\":1}")"
CID="$(printf '%s' "$CHAR" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"

request "${AUTH[@]}" "$BASE_URL/api/characters/stats?character_id=$CID" >/dev/null
request "${AUTH[@]}" "$BASE_URL/api/skills?class_id=1" >/dev/null
request "${AUTH[@]}" "$BASE_URL/api/characters/skills?character_id=$CID" >/dev/null
request "${AUTH[@]}" "$BASE_URL/api/monsters?character_id=$CID" >/dev/null
request "${AUTH[@]}" "$BASE_URL/api/inventory?character_id=$CID" >/dev/null

echo "SMOKE_TEST_OK character_id=$CID"
