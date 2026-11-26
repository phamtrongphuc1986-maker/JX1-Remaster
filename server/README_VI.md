# Realtime server (prototype)

## Run locally
```bash
cd server
npm install
export JX1_SESSION_SECRET="$(openssl rand -hex 32)"
export HOST=127.0.0.1
npm start
```

Health endpoint: `GET /health`. WebSocket protocol: send `{"type":"authenticate","token":"..." }`, then `{"type":"join_map","mapId":"map_city_01"}`, then movement messages `{"type":"move","x":9,"y":12}`.

## Important
The server intentionally does not expose token issuance over HTTP. A real account/authentication service must issue signed tokens after validating a player account. The current server is a transport/multiplayer prototype only: it does not persist characters, inventory, quests, currency, combat, NPC state or map collision, and is not safe for a public production launch. Bind to localhost behind a TLS reverse proxy until hardened.
