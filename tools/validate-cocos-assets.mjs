import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const projectDir = path.join(root, 'client', 'cocos');
const assetsDir = path.join(projectDir, 'assets');
const scriptsDir = path.join(assetsDir, 'scripts');
const manifestPath = path.join(projectDir, 'package.json');

function fail(message) {
  console.error('Cocos asset validation failed: ' + message);
  process.exitCode = 1;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

if (!fs.existsSync(manifestPath)) {
  fail('client/cocos/package.json is missing');
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.creator?.version !== '3.8.0') fail('Creator version must be 3.8.0');
  if (!manifest.dependencies?.cc) fail('cc dependency is missing');
}

const tsFiles = walk(scriptsDir).filter(file => file.endsWith('.ts'));
if (tsFiles.length < 20) fail('expected at least 20 TypeScript files under assets/scripts');

let importCount = 0;
for (const file of tsFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const imports = source.matchAll(/from\s+['"]([^'"]+)['"]/g);
  for (const match of imports) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    importCount++;
    const base = path.resolve(path.dirname(file), specifier);
    const candidates = [base + '.ts', path.join(base, 'index.ts')];
    if (!candidates.some(candidate => fs.existsSync(candidate))) {
      fail(path.relative(root, file) + ' has unresolved import ' + specifier);
    }
  }
}

const authFlowPath = path.join(scriptsDir, 'AuthFlowController.ts');
const entryPath = path.join(scriptsDir, 'JX1GameEntry.ts');
if (!fs.existsSync(authFlowPath)) {
  fail('AuthFlowController.ts is missing');
} else {
  const authFlow = fs.readFileSync(authFlowPath, 'utf8');
  for (const required of [
    'api.login(', 'api.register(', 'api.listClasses(', 'api.listCharacters(',
    'api.createCharacter(', 'renderLogin(', 'renderClasses(',
    'renderCreateCharacter(', 'renderCharacters(', 'enterGame('
  ]) {
    if (!authFlow.includes(required)) fail('AuthFlowController.ts missing flow/API call: ' + required);
  }
}
if (!fs.existsSync(entryPath)) {
  fail('JX1GameEntry.ts is missing');
} else {
  const entry = fs.readFileSync(entryPath, 'utf8');
  if (!entry.includes('AuthFlowController') || !entry.includes('accountFlow.apiBaseUrl = this.apiBaseUrl')) {
    fail('JX1GameEntry.ts does not attach AuthFlowController or pass the staging API URL');
  }
}

const scenePath = path.join(assetsDir, 'scenes', 'Main.scene');
const sceneMetaPath = scenePath + '.meta';
const entryMetaPath = entryPath + '.meta';
if (!fs.existsSync(scenePath) || !fs.existsSync(sceneMetaPath) || !fs.existsSync(entryMetaPath)) {
  fail('Main.scene and its Cocos metadata files are required');
} else {
  try {
    const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
    const sceneMeta = JSON.parse(fs.readFileSync(sceneMetaPath, 'utf8'));
    const entryMeta = JSON.parse(fs.readFileSync(entryMetaPath, 'utf8'));
    const refs = [];
    const visit = value => {
      if (!value || typeof value !== 'object') return;
      if (Object.hasOwn(value, '__id__')) refs.push(value.__id__);
      for (const child of Object.values(value)) visit(child);
    };
    visit(scene);
    if (scene[0]?.__type__ !== 'cc.SceneAsset' || scene[1]?.__type__ !== 'cc.Scene') {
      fail('Main.scene must contain a Cocos SceneAsset and Scene root');
    }
    if (scene[0]?.scene?.__id__ !== 1 || scene[1]?._children?.[0]?.__id__ !== 2 ||
        scene[2]?._components?.[0]?.__id__ !== 3 || scene[3]?.node?.__id__ !== 2) {
      fail('Main.scene object graph does not attach JX1GameEntry to its root node');
    }
    if (refs.some(id => !Number.isInteger(id) || id < 0 || id >= scene.length)) {
      fail('Main.scene contains an invalid serialized object reference');
    }
    if (sceneMeta.importer !== 'scene' || !sceneMeta.uuid ||
        entryMeta.importer !== 'typescript' || !entryMeta.uuid) {
      fail('Main.scene or JX1GameEntry metadata is incomplete');
    }
  } catch (error) {
    fail('Main.scene serialization or metadata is invalid: ' + error.message);
  }
}

const mapDir = path.join(assetsDir, 'resources', 'maps');
const mapFiles = walk(mapDir).filter(file => file.endsWith('.json'));
if (mapFiles.length < 2) fail('expected at least two JSON maps in assets/resources/maps');
for (const file of mapFiles) {
  try {
    const map = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (map.map_id !== path.basename(file, '.json')) fail(path.relative(root, file) + ' map_id does not match filename');
    if (map.projection !== 'isometric' || map.tile_width !== 64 || map.tile_height !== 32) {
      fail(path.relative(root, file) + ' must be 64x32 isometric');
    }
    if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 1 || map.height < 1) {
      fail(path.relative(root, file) + ' has invalid dimensions');
    }
  } catch (error) {
    fail(path.relative(root, file) + ' is invalid JSON: ' + error.message);
  }
}

if (!process.exitCode) {
  console.log('Cocos asset validation passed: ' + tsFiles.length + ' TypeScript files, ' + importCount + ' relative imports, ' + mapFiles.length + ' maps.');
}
