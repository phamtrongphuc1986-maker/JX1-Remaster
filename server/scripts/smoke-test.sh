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

# Verify the server-authoritative world path end to end.
WORLD="$(request "${AUTH[@]}" "$BASE_URL/api/world/snapshot?character_id=$CID")"
MONSTER_ID="$(printf '%s' "$WORLD" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["map_id"] == "map_001_village_test"; print(d["monsters"][0]["id"])')"

# The default character spawn is (9,12); move next to the first shared monster at (15,14).
for _ in 1 2 3 4 5 6; do
  request "${AUTH[@]}" -X POST "$BASE_URL/api/world/move" -d "{\"character_id\":$CID,\"dx\":1,\"dy\":0}" >/dev/null
  sleep 0.16
done
request "${AUTH[@]}" -X POST "$BASE_URL/api/world/move" -d "{\"character_id\":$CID,\"dx\":0,\"dy\":1}" >/dev/null

ATTACK="$(request "${AUTH[@]}" -X POST "$BASE_URL/api/world/attack" \
  -d "{\"character_id\":$CID,\"monster_id\":$MONSTER_ID}")"
printf '%s' "$ATTACK" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["success"] and d["damage"] > 0; print("PASS: authoritative combat")'

WORLD_AFTER="$(request "${AUTH[@]}" "$BASE_URL/api/world/snapshot?character_id=$CID")"
printf '%s' "$WORLD_AFTER" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert any(m["hp"] == 37 for m in d["monsters"]); print("PASS: shared monster HP persisted")'

echo "SMOKE_TEST_OK character_id=$CID"
