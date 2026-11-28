#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8083}"
TEST_USER="${TEST_USER:-jxsmoke$(date +%s)}"
TEST_USER2="${TEST_USER2:-${TEST_USER}_b}"
TEST_PASS="${TEST_PASS:-TestPass123!}"

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }

request() {
  curl --fail --silent --show-error -H 'Content-Type: application/json' "$@"
}

# Account A: register, login, select a faction/class and create a character.
request -X POST "$BASE_URL/api/register" \
  -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" >/dev/null
LOGIN="$(request -X POST "$BASE_URL/api/login" \
  -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")"
TOKEN="$(printf '%s' "$LOGIN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"
AUTH=(-H "Authorization: Bearer $TOKEN")

CLASSES="$(request "${AUTH[@]}" "$BASE_URL/api/classes")"
printf '%s' "$CLASSES" | python3 -c 'import json,sys; d=json.load(sys.stdin); c=d.get("classes", []); assert d.get("count", len(c)) == 10 and any(x["id"] == 1 for x in c); print("PASS: ten classes and selected class")'

CHAR="$(request "${AUTH[@]}" -X POST "$BASE_URL/api/characters/create" \
  -d "{\"name\":\"Smoke$(date +%s)\",\"class_id\":1}")"
CID="$(printf '%s' "$CHAR" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"

request "${AUTH[@]}" "$BASE_URL/api/characters/stats?character_id=$CID" >/dev/null
request "${AUTH[@]}" "$BASE_URL/api/skills?class_id=1" >/dev/null
request "${AUTH[@]}" "$BASE_URL/api/characters/skills?character_id=$CID" >/dev/null
request "${AUTH[@]}" "$BASE_URL/api/monsters?character_id=$CID" >/dev/null
request "${AUTH[@]}" "$BASE_URL/api/inventory?character_id=$CID" >/dev/null
echo "PASS: account A login and character creation"

# Account B: independently register, log in and create a character in the same world.
request -X POST "$BASE_URL/api/register" \
  -d "{\"username\":\"$TEST_USER2\",\"password\":\"$TEST_PASS\"}" >/dev/null
LOGIN2="$(request -X POST "$BASE_URL/api/login" \
  -d "{\"username\":\"$TEST_USER2\",\"password\":\"$TEST_PASS\"}")"
TOKEN2="$(printf '%s' "$LOGIN2" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"
AUTH2=(-H "Authorization: Bearer $TOKEN2")
CHAR2="$(request "${AUTH2[@]}" -X POST "$BASE_URL/api/characters/create" \
  -d "{\"name\":\"SmokeB$(date +%s)\",\"class_id\":2}")"
CID2="$(printf '%s' "$CHAR2" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
echo "PASS: account B login and character creation"

# Both independent accounts enter the same map. Presence must be visible to each other.
request "${AUTH2[@]}" "$BASE_URL/api/world/snapshot?character_id=$CID2" >/dev/null
WORLD_BOTH="$(request "${AUTH[@]}" "$BASE_URL/api/world/snapshot?character_id=$CID")"
printf '%s' "$WORLD_BOTH" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["map_id"] == "map_001_village_test" and len(d["players"]) == 2; print("PASS: two online characters visible in the same world snapshot")'

# Account A moves next to a shared monster and attacks it; account B must see the same HP.
WORLD="$(request "${AUTH[@]}" "$BASE_URL/api/world/snapshot?character_id=$CID")"
MONSTER_ID="$(printf '%s' "$WORLD" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["monsters"][0]["id"])')"
for _ in 1 2 3 4 5 6; do
  request "${AUTH[@]}" -X POST "$BASE_URL/api/world/move" -d "{\"character_id\":$CID,\"dx\":1,\"dy\":0}" >/dev/null
  sleep 0.16
done
request "${AUTH[@]}" -X POST "$BASE_URL/api/world/move" -d "{\"character_id\":$CID,\"dx\":0,\"dy\":1}" >/dev/null

ATTACK="$(request "${AUTH[@]}" -X POST "$BASE_URL/api/world/attack" \
  -d "{\"character_id\":$CID,\"monster_id\":$MONSTER_ID}")"
printf '%s' "$ATTACK" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["success"] and d["damage"] > 0; print("PASS: server-authoritative combat")'

WORLD_AFTER_B="$(request "${AUTH2[@]}" "$BASE_URL/api/world/snapshot?character_id=$CID2")"
printf '%s' "$WORLD_AFTER_B" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert any(m["hp"] == 37 for m in d["monsters"]); print("PASS: account B sees account A shared monster HP update")'

echo "SMOKE_TEST_OK character_ids=$CID,$CID2"
