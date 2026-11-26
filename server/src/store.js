'use strict';
const fs=require('node:fs'),path=require('node:path'),Database=require('better-sqlite3');
class Store{
 constructor(file=process.env.JX1_DB_PATH||path.join(process.cwd(),'data','jx1.sqlite')){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});this.db=new Database(file);
  this.db.pragma('journal_mode=WAL');this.db.pragma('foreign_keys=ON');this.db.pragma('busy_timeout=5000');
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS characters(id TEXT PRIMARY KEY,account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,name TEXT NOT NULL,level INTEGER NOT NULL DEFAULT 1,map_id TEXT NOT NULL DEFAULT 'map_city_01',x INTEGER NOT NULL DEFAULT 9,y INTEGER NOT NULL DEFAULT 12,exp INTEGER NOT NULL DEFAULT 0,gold INTEGER NOT NULL DEFAULT 0,hp INTEGER NOT NULL DEFAULT 100,mp INTEGER NOT NULL DEFAULT 100,updated_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS inventory(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,slot INTEGER NOT NULL,item_json TEXT NOT NULL,PRIMARY KEY(character_id,slot));
   CREATE TABLE IF NOT EXISTS player_sessions(token_id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS idx_session_expiry ON player_sessions(expires_at);`);
  this.q={account:this.db.prepare('SELECT * FROM accounts WHERE username=? COLLATE NOCASE'),character:this.db.prepare('SELECT * FROM characters WHERE account_id=?'),position:this.db.prepare('UPDATE characters SET map_id=?,x=?,y=?,updated_at=? WHERE id=?'),session:this.db.prepare('INSERT INTO player_sessions VALUES(?,?,?,?)'),valid:this.db.prepare('SELECT * FROM player_sessions WHERE token_id=? AND expires_at>?')};
 }
 register(a){this.db.transaction(()=>{this.db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?)').run(a.id,a.username,a.salt,a.hash,a.now);this.db.prepare('INSERT INTO characters(id,account_id,name,updated_at) VALUES(?,?,?,?)').run(a.characterId,a.id,a.username,a.now);})();return this.q.character.get(a.id);}
 account(username){return this.q.account.get(username);}character(id){return this.q.character.get(id);}
 savePlayer(p){this.q.position.run(p.mapId,p.x,p.y,Date.now(),p.characterId);}
 session(tokenId,accountId,expiresAt,now){this.q.session.run(tokenId,accountId,expiresAt,now);}
 validSession(tokenId,now){return this.q.valid.get(tokenId,now);}close(){this.db.close();}
}
module.exports={Store};
