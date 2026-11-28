import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const assets = path.join(root, 'client', 'cocos', 'assets');
const sceneDir = path.join(assets, 'scenes');
const scriptPath = path.join(assets, 'scripts', 'JX1GameEntry.ts');
const scenePath = path.join(sceneDir, 'Main.scene');
const sceneMetaPath = scenePath + '.meta';
const scriptMetaPath = scriptPath + '.meta';
const scriptUuid = 'f3c1a2b4-7d8e-4f90-a123-4567890abcde';
const sceneUuid = 'c21f0d34-6a7b-4c8d-9e10-abcdef123456';
const nodeUuid = 'Jx1MainRootNode0000001';
const componentUuid = 'Jx1EntryComponent00001';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function compressUuid(uuid) {
  const raw = uuid.replaceAll('-', '');
  if (raw.length !== 32) throw new Error('Invalid script UUID');
  let out = raw.slice(0, 5);
  for (let i = 5; i < 32; i += 3) {
    const c = parseInt(raw[i], 16), d = parseInt(raw[i + 1], 16), e = parseInt(raw[i + 2], 16);
    out += alphabet[(c << 2) | (d >> 2)];
    out += alphabet[((d & 3) << 4) | e];
  }
  return out;
}
const vec3 = (x, y, z = 0) => ({ __type__: 'cc.Vec3', x, y, z });
const quat = { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 };
const scene = [
  { __type__: 'cc.SceneAsset', _name: 'Main', _objFlags: 0, __editorExtras__: {}, _native: '', scene: { __id__: 1 } },
  { __type__: 'cc.Scene', _name: 'Main', _objFlags: 0, __editorExtras__: {}, _parent: null, _children: [{ __id__: 2 }], _active: true, _components: [], _prefab: null, _lpos: vec3(0, 0), _lrot: quat, _lscale: vec3(1, 1, 1), _mobility: 0, _layer: 1073741824, _euler: vec3(0, 0), autoReleaseAssets: false, _globals: { __id__: 4 }, _id: sceneUuid },
  { __type__: 'cc.Node', _name: 'JX1GameEntry', _objFlags: 0, __editorExtras__: {}, _parent: { __id__: 1 }, _children: [], _active: true, _components: [{ __id__: 3 }], _prefab: null, _lpos: vec3(0, 0), _lrot: quat, _lscale: vec3(1, 1, 1), _mobility: 0, _layer: 1073741824, _euler: vec3(0, 0), _id: nodeUuid },
  { __type__: compressUuid(scriptUuid), _name: '', _objFlags: 0, __editorExtras__: {}, node: { __id__: 2 }, _enabled: true, __prefab: null, _id: componentUuid },
  { __type__: 'cc.SceneGlobals' },
];
fs.mkdirSync(sceneDir, { recursive: true });
fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2) + '\n');
fs.writeFileSync(sceneMetaPath, JSON.stringify({ ver: '1.1.50', importer: 'scene', imported: true, uuid: sceneUuid, files: ['.json'], subMetas: {}, userData: {} }, null, 2) + '\n');
fs.writeFileSync(scriptMetaPath, JSON.stringify({ ver: '4.0.23', importer: 'typescript', imported: true, uuid: scriptUuid, files: [], subMetas: {}, userData: { moduleId: 'project:///assets/scripts/JX1GameEntry.ts' } }, null, 2) + '\n');

const parsed = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
const refs = [];
function visit(value) {
  if (!value || typeof value !== 'object') return;
  if (Object.hasOwn(value, '__id__')) refs.push(value.__id__);
  for (const child of Object.values(value)) visit(child);
}
visit(parsed);
if (parsed[0].__type__ !== 'cc.SceneAsset' || parsed[1].__type__ !== 'cc.Scene') throw new Error('Scene root serialization invalid');
if (parsed[0].scene.__id__ !== 1 || parsed[1]._children[0].__id__ !== 2 || parsed[2]._components[0].__id__ !== 3) throw new Error('Scene object graph invalid');
if (parsed[3].__type__ !== compressUuid(scriptUuid)) throw new Error('Script UUID type mismatch');
if (!fs.existsSync(scriptPath)) throw new Error('JX1GameEntry.ts missing');
console.log('Main.scene generated and structurally validated: ' + parsed.length + ' serialized objects.');
