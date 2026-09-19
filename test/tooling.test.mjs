import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageManifest = JSON.parse(await readFile('package.json', 'utf8'));
const workspaceManifest = await readFile('pnpm-workspace.yaml', 'utf8');

test('the root pins the supported package manager and runtime', () => {
  assert.equal(packageManifest.packageManager, 'pnpm@11.26.0');
  assert.equal(packageManifest.engines.node, '>=24.21 <25');
});

test('the workspace includes application and package shells', () => {
  assert.match(workspaceManifest, /- apps\/\*/);
  assert.match(workspaceManifest, /- packages\/\*/);
});

test('the required repository tooling is configured', () => {
  assert.equal(packageManifest.scripts.lint, 'eslint .');
  assert.equal(packageManifest.scripts.typecheck, 'tsc --noEmit');
  assert.equal(packageManifest.scripts.prepare, 'husky');
  assert.ok(packageManifest.devDependencies['@changesets/cli']);
  assert.ok(packageManifest.devDependencies['@commitlint/cli']);
  assert.ok(packageManifest.devDependencies.husky);
  assert.ok(packageManifest.devDependencies['lint-staged']);
});
