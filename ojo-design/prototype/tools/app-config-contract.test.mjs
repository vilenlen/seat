import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const prototypeRoot = path.resolve(import.meta.dirname, '..');
const rspackConfigPath = path.join(prototypeRoot, 'rspack.config.ts');
const appSourcePath = path.join(prototypeRoot, 'src/core/app.ts');

test('__APP_CONFIG__ uses the same bare global define pattern as other injected app constants', async () => {
  const [rspackConfigSource, appSource] = await Promise.all([
    fs.readFile(rspackConfigPath, 'utf8'),
    fs.readFile(appSourcePath, 'utf8'),
  ]);

  assert.match(rspackConfigSource, /__APP_CONFIG__:\s*JSON\.stringify\(appRuntimeConfig\)/);
  assert.doesNotMatch(rspackConfigSource, /['"]window\.__APP_CONFIG__['"]\s*:/);

  assert.match(appSource, /const supabaseUrl = __APP_CONFIG__\?\.supabaseUrl\?\.trim\(\);/);
  assert.match(appSource, /const supabaseAnonKey = __APP_CONFIG__\?\.supabaseAnonKey\?\.trim\(\);/);
  assert.match(appSource, /const __APP_CONFIG__:/);
  assert.doesNotMatch(appSource, /window\.__APP_CONFIG__/);
});
