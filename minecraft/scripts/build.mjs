// Builds the behavior pack into dist/ and, with --package, zips it as a .mcaddon.
// --deploy copies the pack into Minecraft's development_behavior_packs folder
// (set MC_DEV_BP to override the path), so `/reload` in the game picks up changes.
import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const out = join(root, 'dist/EmeraldMaze');
await rm(join(root, 'dist'), { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(root, 'pack'), out, { recursive: true });
await build({
  entryPoints: [join(root, 'src/main.ts')],
  outfile: join(out, 'scripts/main.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  external: ['@minecraft/server', '@minecraft/server-ui'],
  logLevel: 'warning',
});
console.log('Built', out);

if (process.argv.includes('--package')) {
  const file = join(root, 'dist/EmeraldMaze.mcaddon');
  execFileSync('zip', ['-qr', file, 'EmeraldMaze'], { cwd: join(root, 'dist') });
  console.log('Packaged', file);
}

if (process.argv.includes('--deploy')) {
  const target =
    process.env.MC_DEV_BP ??
    join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData/Local'),
      'Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang/development_behavior_packs');
  await rm(join(target, 'EmeraldMaze'), { recursive: true, force: true });
  await cp(out, join(target, 'EmeraldMaze'), { recursive: true });
  console.log('Deployed to', join(target, 'EmeraldMaze'));
}
