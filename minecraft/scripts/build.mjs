// Builds the behavior pack into dist/ and, with --package, zips it as a .mcaddon.
// --deploy copies the pack into Minecraft's development_behavior_packs folder
// (set MC_DEV_BP to override the path), so `/reload` in the game picks up changes.
import { build } from 'esbuild';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { zipSync } from 'fflate';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const forServer = process.argv.includes('--server');
const outputDir = join(root, forServer ? '.bedrock' : 'dist');
const out = join(outputDir, 'EmeraldMaze');
await rm(outputDir, { recursive: true, force: true });
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

if (forServer) {
  const { header } = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8'));
  const packs = [{ pack_id: header.uuid, version: header.version }];
  await writeFile(join(outputDir, 'world_behavior_packs.json'), JSON.stringify(packs, null, 2) + '\n');
}

if (process.argv.includes('--package')) {
  const file = join(root, 'dist/EmeraldMaze.mcaddon');
  const entries = await readdir(out, { recursive: true, withFileTypes: true });
  const files = await Promise.all(entries.filter(entry => entry.isFile()).map(async entry => {
    const path = join(entry.parentPath, entry.name);
    const archivePath = 'EmeraldMaze/' + relative(out, path).split(sep).join('/');
    return [archivePath, await readFile(path)];
  }));
  await writeFile(file, zipSync(Object.fromEntries(files)));
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
