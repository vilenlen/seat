import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const workspaceRoot = path.resolve(import.meta.dirname, '..', '..');
const prototypeRoot = path.join(workspaceRoot, 'prototype');
const workspacePackageJsonPath = path.join(workspaceRoot, 'package.json');
const rspackConfigPath = path.join(prototypeRoot, 'rspack.config.ts');

test('prototype build pins React versions and resolves React through one package instance', async () => {
  const [workspacePackageJsonSource, rspackConfigSource] = await Promise.all([
    fs.readFile(workspacePackageJsonPath, 'utf8'),
    fs.readFile(rspackConfigPath, 'utf8'),
  ]);

  const workspacePackageJson = JSON.parse(workspacePackageJsonSource);
  assert.equal(workspacePackageJson.pnpm?.overrides?.react, '18.3.1');
  assert.equal(workspacePackageJson.pnpm?.overrides?.['react-dom'], '18.3.1');

  assert.match(rspackConfigSource, /createRequire\(import\.meta\.url\)/);
  assert.match(rspackConfigSource, /require\.resolve\('react\/package\.json'\)/);
  assert.match(rspackConfigSource, /require\.resolve\('react-dom\/package\.json'\)/);
  assert.match(rspackConfigSource, /require\.resolve\('react-dom\/client'\)/);
  assert.match(rspackConfigSource, /'react\$':\s*reactPackageRoot/);
  assert.match(rspackConfigSource, /'react-dom\$':\s*reactDomPackageRoot/);
  assert.match(rspackConfigSource, /'react-dom\/client\$':\s*reactDomClientEntry/);
});
