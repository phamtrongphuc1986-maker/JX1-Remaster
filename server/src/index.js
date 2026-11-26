'use strict';
const http=require('node:http'),crypto=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');
const {Store}=require('./store');
const {normalizeUsername,createPassword,verifyPassword,issueToken,readToken}=require('./auth');
const PORT=Number(process.env.PORT||8080),HOST=process.env.HOST||'127.0.0.1',SECRET=process.env.JX1_SESSION_SECRET;
if(!SECRET||SECRET.length<32)throw new Error('JX1_SESSION_SECRET must contain at least 32 characters');
const store=new Store(),rooms=new Map(),sockets=new Map(),MAX=4096;
const send=(ws,type,p={})=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type,...p}));};
function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));}
function body(req){return new Promise((ok,no)=>{let s='';req.on('data',c=>{s+=c;if(s.length>8192){no(Error('BODY_TOO_LARGE'));req.destroy();}});req.on('end',()=>{try{ok(JSON.parse(s||'{}'));}catch{no(Error('BAD_JSON'));}});req.on('error',no);});}
function broadcast(map,type,payload,except){for(const id of rooms.get(map)||[]){const s=sockets.get(id);if(s&&s.ws!==except)send(s.ws,type,payload);}}
function leave(id){const s=sockets.get(id);if(!s)return;store.savePlayer(s.player);const room=rooms.get(s.player.mapId);if(room){room.delete(id);broadcast(s.player.mapId,'player_left',{playerId:s.player.id});if(!room.size)rooms.delete(s.player.mapId);}sockets.delete(id);}
function validCell(n){return Number.isInteger(n)&&n>=0&&n<20;}
function join(id,ws,mapId){const c=store.character(id);if(!c)return false;leave(id);if(!rooms.has(mapId))rooms.set(mapId,new Set());rooms.get(mapId).add(id);const p={id:c.id,characterId:c.id,mapId,x:c.x,y:c.y,level:c.level,ws};sockets.set(id,{ws,player:p,lastMove:0});send(ws,'world_snapshot',{mapId,players:[...rooms.get(mapId)].map(k=>{const q=sockets.get(k).player;return{playerId:q.id,x:q.x,y:q.y,level:q.level};})});broadcast(mapId,'player_joined',{playerId:p.id,x:p.x,y:p.y,level:p.level},ws);return true;}
const server=http.createServer(async(req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return json(res,200,{ok:true,service:'jx1-remaster',players:sockets.size,storage:'sqlite'});
 if(req.method==='POST'&&(req.url==='/auth/register'||req.url==='/auth/login'))try{
  const b=await body(req),username=normalizeUsername(b.username);if(!username||typeof b.password!=='string')return json(res,400,{error:'INVALID_CREDENTIALS'});
  let a=store.account(username);
  if(req.url==='/auth/register'){if(a)return json(res,409,{error:'USERNAME_EXISTS'});const pw=await createPassword(b.password),id=crypto.randomUUID(),characterId=crypto.randomUUID();store.register({id,username,salt:pw.salt,hash:pw.hash,characterId,now:Date.now()});a=store.account(username);}
  else if(!a||!(await verifyPassword(b.password,a.password_salt,a.password_hash)))return json(res,401,{error:'LOGIN_FAILED'});
  const t=issueToken(a.id,SECRET);store.session(t.tokenId,a.id,t.expiresAt,Date.now());return json(res,200,{token:t.token,expiresAt:t.expiresAt,character:store.character(a.id)});
 }catch(e){return json(res,e.message==='BODY_TOO_LARGE'?413:400,{error:e.message==='BODY_TOO_LARGE'?'BODY_TOO_LARGE':'BAD_REQUEST',message:e.message});}
 return json(res,404,{error:'NOT_FOUND'});
});
const wss=new WebSocketServer({server,maxPayload:MAX});
wss.on('connection',ws=>{let accountId=null,count=0,start=Date.now();ws.on('message',raw=>{
 const now=Date.now();if(now-start>=1000){count=0;start=now;}if(++count>20){send(ws,'error',{code:'RATE_LIMIT'});ws.close(1008);return;}
 let m;try{m=JSON.parse(raw.toString());}catch{return send(ws,'error',{code:'BAD_JSON'});}
 if(!accountId){if(m.type!=='authenticate'){send(ws,'error',{code:'AUTH_REQUIRED'});ws.close(1008);return;}const d=readToken(m.token,SECRET),s=d&&store.validSession(d.jti,now);if(!d||!s||s.account_id!==d.sub){send(ws,'error',{code:'AUTH_FAILED'});ws.close(1008);return;}accountId=d.sub;send(ws,'authenticated',{accountId});return;}
 if(m.type==='join_map'){if(typeof m.mapId!=='string'||!/^[a-z0-9_]{3,64}$/.test(m.mapId))return send(ws,'error',{code:'BAD_MAP'});if(!join(accountId,ws,m.mapId))send(ws,'error',{code:'NO_CHARACTER'});return;}
 const s=sockets.get(accountId);if(!s||s.ws!==ws)return;
 if(m.type==='move'){if(!validCell(m.x)||!validCell(m.y))return send(ws,'error',{code:'BAD_POSITION'});if(now-s.lastMove<120)return;s.lastMove=now;s.player.x=m.x;s.player.y=m.y;store.savePlayer(s.player);broadcast(s.player.mapId,'player_moved',{playerId:s.player.id,x:m.x,y:m.y},ws);}
 else if(m.type==='ping')send(ws,'pong',{at:now});
 });ws.on('close',()=>{if(accountId)leave(accountId);});ws.on('error',()=>{if(accountId)leave(accountId);});});
server.listen(PORT,HOST,()=>console.log('JX1 persistent prototype listening '+HOST+':'+PORT));
function shutdown(){for(const s of sockets.values())store.savePlayer(s.player);server.close(()=>{store.close();process.exit(0);});}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
