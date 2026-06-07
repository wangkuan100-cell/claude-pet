import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const celesteDir = path.join(root, 'assets', 'skeletal-demo', 'spine-celeste');
const spineboyDir = path.join(root, 'assets', 'skeletal-demo', 'spineboy-run');
const previewPath = path.join(root, 'widget', 'renderer', 'skeletal-demo.html');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('spine celeste skeletal demo manifest points to GitHub evaluation assets', () => {
  const manifest = readJson(path.join(celesteDir, 'manifest.json'));

  assert.equal(manifest.id, 'spine-celeste-remote');
  assert.equal(manifest.engine, 'spine');
  assert.match(manifest.source.repository, /EsotericSoftware\/spine-runtimes/);
  assert.equal(manifest.source.ref, '4.3');
  assert.match(manifest.files.skeletonUrl, /^https:\/\/raw\.githubusercontent\.com\/EsotericSoftware\/spine-runtimes\/4\.3\/examples\/celestial-circus\/export\/celestial-circus-pro\.json$/);
  assert.match(manifest.files.atlasUrl, /^https:\/\/raw\.githubusercontent\.com\/EsotericSoftware\/spine-runtimes\/4\.3\/examples\/celestial-circus\/export\/celestial-circus-pma\.atlas$/);
  assert.match(manifest.files.textureUrl, /^https:\/\/raw\.githubusercontent\.com\/EsotericSoftware\/spine-runtimes\/4\.3\/examples\/celestial-circus\/export\/celestial-circus-pma\.png$/);
  assert.match(manifest.files.licenseUrl, /^https:\/\/raw\.githubusercontent\.com\/EsotericSoftware\/spine-runtimes\/4\.3\/examples\/celestial-circus\/license\.txt$/);
  assert.equal(manifest.productionUse, false);
});

test('spine celeste skeletal demo targets wing and foot motion without vendored sample files', () => {
  const manifest = readJson(path.join(celesteDir, 'manifest.json'));

  assert.equal(manifest.animations.includes('wings-and-feet'), true);
  assert.equal(manifest.animations.includes('eyeblink'), true);
  assert.equal(manifest.validationGoal, 'Verify true skeletal wing flapping and foot motion before phoenix legendary rigging.');
  assert.equal(manifest.productionRigTarget, 'DragonBones/LoongBones');

  for (const file of Object.values(manifest.files)) assert.match(file, /^https:\/\//);
  assert.equal(fs.existsSync(path.join(celesteDir, 'celestial-circus-pro.json')), false);
  assert.equal(fs.existsSync(path.join(celesteDir, 'celestial-circus-pma.png')), false);
});

test('spineboy run skeletal demo manifest targets true leg run motion', () => {
  const manifest = readJson(path.join(spineboyDir, 'manifest.json'));

  assert.equal(manifest.id, 'spineboy-run-remote');
  assert.equal(manifest.engine, 'spine');
  assert.match(manifest.source.repository, /EsotericSoftware\/spine-runtimes/);
  assert.equal(manifest.source.ref, '4.3');
  assert.match(manifest.files.skeletonUrl, /^https:\/\/raw\.githubusercontent\.com\/EsotericSoftware\/spine-runtimes\/4\.3\/examples\/spineboy\/export\/spineboy-pro\.json$/);
  assert.match(manifest.files.atlasUrl, /^https:\/\/raw\.githubusercontent\.com\/EsotericSoftware\/spine-runtimes\/4\.3\/examples\/spineboy\/export\/spineboy-pma\.atlas$/);
  assert.match(manifest.files.textureUrl, /^https:\/\/raw\.githubusercontent\.com\/EsotericSoftware\/spine-runtimes\/4\.3\/examples\/spineboy\/export\/spineboy-pma\.png$/);
  assert.equal(manifest.animations.includes('run'), true);
  assert.equal(manifest.validationGoal, 'Verify true skeletal leg run motion before phoenix legendary rigging.');
  assert.equal(manifest.productionUse, false);
});

test('standalone skeletal demo page loads the demo assets without entering production pet renderer', () => {
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /SpinePlayer/);
  assert.match(html, /assets\/skeletal-demo\/spine-celeste\/manifest\.json/);
  assert.match(html, /assets\/skeletal-demo\/spineboy-run\/manifest\.json/);
  assert.match(html, /wings-and-feet/);
  assert.match(html, /run/);
  assert.match(html, /@esotericsoftware\/spine-player@4\.3/);
  assert.doesNotMatch(html, /pet3d\.js|petlive2d\.js|pet\.js/);
});
