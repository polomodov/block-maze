import test from 'node:test';
import assert from 'node:assert/strict';
import { bedrock } from './bedrock-fixture.mjs';

const saveKey = 'emerald_maze:return';

test('restarting an active game preserves the original position and mode', () => {
  const sim = bedrock(), player = sim.player('alex', 1.5);
  const home = { ...player.location };
  sim.start(player);
  sim.start(player, 'small');
  sim.flushTimers();
  assert.equal(player.mode, 'adventure');
  assert.ok(sim.dimension.blocks.size > 0);
  sim.stop(player);
  sim.flushTimers();
  assert.deepEqual(player.location, home);
  assert.equal(player.effects.size, 0);
  assert.equal(player.mode, 'creative');
  assert.equal(player.getDynamicProperty(saveKey), undefined);
  assert.equal(sim.dimension.blocks.size, 0);
});

test('a delayed finish cannot restore a replacement game', () => {
  const sim = bedrock(), player = sim.player('alex');
  sim.start(player);
  const mob = sim.dimension.mobs[0];
  for (let life = 0; life < 3; life++) {
    mob.teleport(player.location);
    sim.events.tick();
  }
  assert.equal(player.lastSound, 'mob.husk.ambient');
  sim.start(player, 'small');
  sim.flushTimers();
  assert.equal(player.mode, 'adventure');
  assert.ok(player.getDynamicProperty(saveKey));
  assert.ok(sim.dimension.blocks.size > 0);
});

test('occupied floor, interior and roof are rejected before any block writes', () => {
  for (const y of [280, 282, 284]) {
    const sim = bedrock(), player = sim.player('alex');
    const key = [7, y, -7].join(',');
    sim.dimension.blocks.set(key, 'minecraft:chest');
    sim.start(player, 'small');
    assert.equal(sim.dimension.writes, 0);
    assert.equal(sim.dimension.blocks.get(key), 'minecraft:chest');
    assert.equal(player.mode, 'creative');
    assert.equal(player.getDynamicProperty(saveKey), undefined);
  }
});

test('unloaded space is rejected and a partial construction rolls back', () => {
  const sim = bedrock(), player = sim.player('alex');
  sim.dimension.loaded = false;
  sim.start(player);
  assert.equal(sim.dimension.writes, 0);
  sim.dimension.loaded = true;
  const fill = sim.dimension.fillBlocks.bind(sim.dimension);
  let calls = 0;
  sim.dimension.fillBlocks = (...args) => {
    if (++calls === 2) throw new Error('interrupted build');
    return fill(...args);
  };
  sim.start(player);
  assert.ok(sim.dimension.writes > 0);
  assert.equal(sim.dimension.blocks.size, 0);
  assert.equal(player.getDynamicProperty(saveKey), undefined);
  sim.start(sim.player('second'), 'small');
  assert.ok(sim.dimension.blocks.size > 0);
});

test('reservations survive reloads, reject a shared edge block and permit adjacent arenas and other dimensions', () => {
  const sim = bedrock(), first = sim.player('first');
  sim.start(first, 'small');
  sim.reload();
  // Even if the maze blocks disappear, its pending cleanup still owns the volume.
  sim.dimension.blocks.clear();
  const writes = sim.dimension.writes;
  const crossing = sim.player('crossing', 14);
  sim.start(crossing, 'small');
  assert.equal(sim.dimension.writes, writes);
  assert.equal(crossing.mode, 'creative');
  const adjacent = sim.player('adjacent', 15);
  sim.start(adjacent, 'small');
  assert.equal(adjacent.mode, 'adventure');
  const otherDimension = sim.player('other', 0, sim.world.getDimension('nether'));
  sim.start(otherDimension, 'small');
  assert.equal(otherDimension.mode, 'adventure');
  const adjacentBlocks = new Map(sim.dimension.blocks);
  sim.events.spawn({ player: first, initialSpawn: true });
  assert.deepEqual(sim.dimension.blocks, adjacentBlocks);
});

test('recovery after a reload removes only mobs belonging to the returning player', () => {
  const sim = bedrock(), first = sim.player('first'), second = sim.player('second', 80);
  sim.start(first);
  const firstMobs = [...sim.dimension.mobs];
  sim.start(second);
  const secondMobs = sim.dimension.mobs.slice(firstMobs.length);
  assert.equal(secondMobs.length, 2);
  // Move a mob out of the arena to distinguish ownership from proximity.
  firstMobs[0].teleport(second.location);
  sim.reload();
  sim.events.spawn({ player: first, initialSpawn: true });
  assert.ok(firstMobs.every(mob => !mob.isValid));
  assert.ok(secondMobs.every(mob => mob.isValid));
  assert.equal(first.mode, 'creative');
});

test('returning after a disconnect leaves a reused arena intact', () => {
  const sim = bedrock(), first = sim.player('first'), second = sim.player('second');
  sim.start(first);
  sim.events.leave({ playerId: first.id });
  sim.start(second);
  const blocks = new Map(sim.dimension.blocks);
  sim.events.spawn({ player: first, initialSpawn: true });
  assert.deepEqual(sim.dimension.blocks, blocks);
  assert.equal(sim.dimension.mobs.filter(mob => mob.isValid).length, 2);
  assert.equal(first.mode, 'creative');
});

test('legacy saves restore the player without clearing unowned blocks or mobs', () => {
  const sim = bedrock(), first = sim.player('first'), second = sim.player('second');
  sim.start(second);
  const writes = sim.dimension.writes;
  first.mode = 'adventure';
  first.setDynamicProperty(saveKey, JSON.stringify({
    dim: 'overworld', x: 8, y: 60, z: 2, mode: 'survival', area: [-11, 280, -11, 23],
  }));
  sim.events.spawn({ player: first, initialSpawn: true });
  assert.equal(first.mode, 'survival');
  assert.deepEqual(first.location, { x: 8, y: 60, z: 2 });
  assert.equal(sim.dimension.writes, writes);
  assert.ok(sim.dimension.mobs.every(mob => mob.isValid));
});

test('failed cleanup keeps the reservation until the owner can retry', () => {
  const sim = bedrock(), first = sim.player('first'), second = sim.player('second');
  sim.start(first);
  sim.dimension.loaded = false;
  sim.stop(first);
  assert.equal(first.mode, 'creative');
  sim.dimension.loaded = true;
  sim.dimension.blocks.clear();
  sim.start(second);
  assert.equal(second.mode, 'creative');
  sim.stop(first);
  sim.start(second);
  assert.equal(second.mode, 'adventure');
});

test('starting immediately after joining is safe from stale spawn callbacks', () => {
  const sim = bedrock(), player = sim.player('alex');
  sim.events.spawn({ player, initialSpawn: true });
  sim.start(player, 'small');
  sim.flushTimers();
  assert.equal(player.mode, 'adventure');
  assert.ok(sim.dimension.blocks.size > 0);
});
