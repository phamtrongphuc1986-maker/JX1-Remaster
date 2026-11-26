'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'../../assets/resources/maps/world_map_layouts_v1.json');
const data=JSON.parse(fs.readFileSync(file,'utf8'));
test('world layout has 7 cities and 14 localities',()=>{assert.equal(data.maps.length,21);assert.equal(data.maps.filter(m=>m.location_type==='city').length,7);assert.equal(data.maps.filter(m=>m.location_type==='locality').length,14);});
test('every prototype map has 20x20 terrain, gates, safe spawn and NPCs',()=>{for(const m of data.maps){assert.equal(m.ground.length,20,m.map_id);assert.ok(m.ground.every(r=>r.length===20),m.map_id);assert.equal(m.gates.length,4,m.map_id);assert.ok(m.npcs.length>=2,m.map_id);assert.ok(m.spawn_points.length>0,m.map_id);for(const p of m.spawn_points)assert.ok(m.ground[p.y][p.x]!==3&&m.ground[p.y][p.x]!==4,m.map_id);}});
