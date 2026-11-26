'use strict';

// Prototype authoritative realtime server. Not production-ready:
// persistence, account service, TLS termination, moderation and anti-cheat
// still need to be integrated before public release.
const http = require('node:http');
const crypto = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_MESSAGE_BYTES = 4096;
const TICK_MS = 100;
const MAX_MESSAGES_PER_SECOND = 20;
const sessions = new Map();
const players = new Map();
const rooms = new Map();

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function issueDevToken(playerId) {
  const secret = process.env.JX1_SESSION_SECRET;
  if (!secret) throw new Error('JX1_SESSION_SECRET is required');
  const payload = Buffer.from(JSON.stringify({ sub: playerId, exp: Date.now() + 3600000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + '.' + sig;
}
function verifyToken(token) {
  const secret = process.env.JX1_SESSION_SECRET;
  if (!secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url');
  if (!safeEqual(expected, parts[1])) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return data.exp > Date.now() && typeof data.sub === 'string' ? data.sub : null;
  } catch { return null; }
}
function send(ws, type, payload = {}) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, ...payload }));
}
function broadcast(roomId, type, payload, except) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const id of room) {
    const p = players.get(id);
    if (p && p.ws !== except) send(p.ws, type, payload);
  }
}
function leave(playerId) {
  const p = players.get(playerId);
  if (!p) return;
  const room = rooms.get(p.mapId);
  if (room) {
    room.delete(playerId);
    broadcast(p.mapId, 'player_left', { playerId });
    if (!room.size) rooms.delete(p.mapId);
  }
  players.delete(playerId);
}
function join(playerId, ws, mapId) {
  leave(playerId);
  if (!rooms.has(mapId)) rooms.set(mapId, new Set());
  rooms.get(mapId).add(playerId);
  const p = { id: playerId, ws, mapId, x: 9, y: 12, level: 1, lastMove: 0 };
  players.set(playerId, p);
  send(ws, 'world_snapshot', {
    mapId,
    players: [...rooms.get(mapId)].map(id => {
      const q = players.get(id);
      return { playerId: q.id, x: q.x, y: q.y, level: q.level };
    })
  });
  broadcast(mapId, 'player_joined', { playerId, x: p.x, y: p.y, level: p.level }, ws);
}
function validGrid(n) { return Number.isInteger(n) && n >= 0 && n < 20; }

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'jx1-remaster-realtime', players: players.size }));
    return;
  }
  res.writeHead(404); res.end('Not found');
});
const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES });
wss.on('connection', (ws, req) => {
  let playerId = null;
  let count = 0;
  let windowStart = Date.now();
  ws.on('message', raw => {
    const now = Date.now();
    if (now - windowStart >= 1000) { count = 0; windowStart = now; }
    if (++count > MAX_MESSAGES_PER_SECOND) { send(ws, 'error', { code: 'RATE_LIMIT' }); ws.close(1008, 'rate limit'); return; }
    let msg;
    try { msg = JSON.parse(raw.toString('utf8')); } catch { send(ws, 'error', { code: 'BAD_JSON' }); return; }
    if (!playerId) {
      if (msg.type !== 'authenticate') { send(ws, 'error', { code: 'AUTH_REQUIRED' }); ws.close(1008); return; }
      playerId = verifyToken(msg.token);
      if (!playerId) { send(ws, 'error', { code: 'AUTH_FAILED' }); ws.close(1008); return; }
      send(ws, 'authenticated', { playerId });
      return;
    }
    if (msg.type === 'join_map') {
      if (typeof msg.mapId !== 'string' || !/^[a-z0-9_]{3,64}$/.test(msg.mapId)) { send(ws, 'error', { code: 'BAD_MAP' }); return; }
      join(playerId, ws, msg.mapId);
      return;
    }
    const p = players.get(playerId);
    if (!p || p.ws !== ws) return;
    if (msg.type === 'move') {
      if (!validGrid(msg.x) || !validGrid(msg.y)) { send(ws, 'error', { code: 'BAD_POSITION' }); return; }
      if (now - p.lastMove < 120) return;
      p.lastMove = now; p.x = msg.x; p.y = msg.y;
      broadcast(p.mapId, 'player_moved', { playerId, x: p.x, y: p.y }, ws);
      return;
    }
    if (msg.type === 'ping') send(ws, 'pong', { at: now });
  });
  ws.on('close', () => { if (playerId) leave(playerId); });
  ws.on('error', () => { if (playerId) leave(playerId); });
});

server.listen(PORT, HOST, () => {
  console.log('JX1 Remaster realtime server listening on ' + HOST + ':' + PORT);
});
