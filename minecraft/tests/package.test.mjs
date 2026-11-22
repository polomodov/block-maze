import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import { unzipSync } from 'fflate';

test('package and local deployment work under a path with spaces and Unicode', async t => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  // The temporary checkout inherits node_modules from the parent directory.
  const checkout = await mkdtemp(join(root, 'Тест сборки #'));
  t.after(() => rm(checkout, { recursive: true, force: true }));
  await Promise.all(['scripts', 'src', 'pack'].map(dir =>
    cp(join(root, dir), join(checkout, dir), { recursive: true })));
  const target = join(checkout, 'тестовые паки');
  execFileSync(process.execPath, ['scripts/build.mjs', '--package', '--deploy'], {
    cwd: checkout, env: { ...process.env, MC_DEV_BP: target },
  });
  const archive = unzipSync(await readFile(join(checkout, 'dist/EmeraldMaze.mcaddon')));
  const expected = ['EmeraldMaze/manifest.json', 'EmeraldMaze/pack_icon.png', 'EmeraldMaze/scripts/main.js'];
  assert.deepEqual(Object.keys(archive).sort(), expected);
  await Promise.all(expected.map(async name => {
    assert.deepEqual(Buffer.from(archive[name]), await readFile(join(target, name)));
  }));
});
