import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from '../engine.js';

function place(actor, x, y) {
  Object.assign(actor, { x, y, dir: null, target: null });
}

function encounter(level, type, hero = 'kirill') {
  const game = createGame(hero, level);
  const { state } = game;
  game.start();
  game.turn('right');
  game.update(0.01);
  const monster = state.monsters.find(m => m.type === type);
  for (const other of state.monsters) {
    if (other !== monster) other.stun = 100;
  }
  monster.skillCooldown = 0;
  return { game, state, monster };
}

function acrossLava(type, hero) {
  const encounterAtRiver = encounter('nether', type, hero);
  const { state, monster } = encounterAtRiver;
  place(monster, 9, 6);
  place(state.player, 12, 6);
  return encounterAtRiver;
}

function crossBridge(row) {
  const { game, state } = acrossLava('magma_cube');
  state.monsters.forEach(m => { m.stun = 100; });
  place(state.player, 9, row);
  game.turn('right');
  game.update(3 / 3.8);
  return state;
}

test('three bridges connect the two banks; the hero cannot walk into the lava between them', () => {
  for (const row of [3, 7, 11]) {
    const state = crossBridge(row);
    assert.deepEqual([state.player.x, state.player.y], [12, row]);
    assert.ok(state.bridges.some(([x, y]) => x === 10 && y === row));
    assert.ok(state.bridges.some(([x, y]) => x === 11 && y === row));
  }
  const state = crossBridge(6);
  assert.equal(state.map[6][10], '~');
  assert.equal(state.player.x, 9);
});

test('a ghast warns before a fireball crosses open lava and hits the hero', () => {
  const { game, state, monster } = acrossLava('ghast');
  game.update(0.02);
  assert.ok(monster.windup > 0);
  assert.equal(monster.aim.dir, 'right');
  assert.equal(state.effects.length, 0);
  game.update(1.32);
  const shot = state.effects.find(effect => effect.type === 'fireball');
  assert.ok(shot);
  assert.equal(state.map[Math.round(shot.y)][Math.round(shot.x)], '~');
  game.pause();
  const x = shot.x;
  game.update(5);
  assert.equal(shot.x, x);
  game.resume();
  game.update(0.7);
  assert.equal(state.lives, 2);
  assert.equal(state.effects.length, 0);
});

test('stone blocks both targeting and fireballs, and a hero can dodge behind the wall', () => {
  const { game, state, monster } = acrossLava('ghast');
  place(state.player, 14, 6);
  assert.equal(state.map[6][13], '#');
  game.update(0.01);
  assert.equal(monster.windup, 0);
  place(monster, 9, 6);
  place(state.player, 12, 6);
  game.update(0.1);
  assert.ok(monster.windup > 0);
  place(state.player, 14, 6);
  game.update(1.2);
  assert.ok(state.effects.some(effect => effect.type === 'fireball'));
  game.update(1);
  assert.equal(state.effects.length, 0);
  assert.equal(state.lives, 3);
});

test('invisibility clears a ghast fireball already in flight', () => {
  const { game, state } = acrossLava('ghast', 'mom');
  game.update(1.2);
  assert.ok(state.effects.some(effect => effect.type === 'fireball'));
  assert.ok(game.activate());
  game.update(1);
  assert.equal(state.effects.length, 0);
  assert.equal(state.lives, 3);
});

test('a magma cube marks its landing, jumps across the lava and can be dodged', () => {
  const { game, state, monster } = acrossLava('magma_cube');
  game.update(0.02);
  assert.ok(monster.windup > 0);
  assert.deepEqual([monster.aim.x, monster.aim.y], [12, 6]);
  place(state.player, 12, 7);
  game.update(0.87);
  assert.ok(monster.leap.progress > 0 && monster.leap.progress < 1);
  assert.equal(state.map[Math.round(monster.y)][Math.round(monster.x)], '~');
  const progress = monster.leap.progress;
  game.pause();
  game.update(2);
  assert.equal(monster.leap.progress, progress);
  game.resume();
  game.update(0.34);
  assert.equal(monster.leap, null);
  assert.equal(Math.round(monster.x), 12);
  assert.equal(Math.round(monster.y), 6);
  assert.equal(state.lives, 3);
});

test('Dad scares a preparing magma cube; it cannot start or finish that leap', () => {
  const { game, state, monster } = acrossLava('magma_cube', 'dad');
  game.update(0.1);
  assert.ok(monster.windup > 0);
  assert.ok(game.activate());
  game.update(1.3);
  assert.equal(monster.windup, 0);
  assert.equal(monster.leap, null);
  assert.ok(monster.x < 10);
  assert.equal(state.lives, 3);
});

test('a ghost freezes under a direct gaze and resumes when the player turns away', () => {
  const { game, state, monster } = encounter('castle', 'ghost');
  place(state.player, 7, 13);
  place(monster, 10, 13);
  game.turn('right');
  game.update(0.15);
  assert.equal(monster.watched, true);
  assert.equal(monster.x, 10);
  game.turn('left');
  game.update(0.15);
  assert.equal(monster.watched, false);
  assert.notEqual(monster.x, 10);
});

test('the pumpkin guard warns before lighting three corridor cells; the lantern slows without damage', () => {
  const { game, state, monster } = encounter('castle', 'pumpkin_guard');
  place(monster, 10, 13);
  place(state.player, 7, 13);
  game.update(0.1);
  assert.ok(monster.windup > 0);
  assert.deepEqual(monster.cells, [[9, 13], [8, 13], [7, 13]]);
  assert.equal(state.slow, 0);
  game.update(1);
  const beam = state.effects.find(effect => effect.type === 'lantern');
  assert.deepEqual(beam.cells, [[9, 13], [8, 13], [7, 13]]);
  assert.ok(state.slow > 0);
  assert.equal(state.lives, 3);
});

function advanceUntil(game, condition, maxSeconds = 12) {
  for (let step = 0; step < maxSeconds * 60 && !condition(); step++) game.update(1 / 60);
  assert.ok(condition());
}

function dragonEncounter(hero = 'kirill') {
  const { game, state } = encounter('end', 'enderman', hero);
  for (const monster of state.monsters) monster.stun = 100;
  place(state.player, 11, 13);
  advanceUntil(game, () => state.dragon.phase === 'warning');
  return { game, state };
}

test('the End dragon flies above walls while waiting and freezes with the game', () => {
  const game = createGame('mom', 'end');
  const { state } = game;
  game.start();
  const spawns = state.monsters.map(m => [m.x, m.y]);
  advanceUntil(game, () => state.map[Math.round(state.dragon.y)][Math.round(state.dragon.x)] === '#');
  const { x } = state.dragon;
  game.update(0.2);
  assert.notEqual(state.dragon.x, x);
  game.update(17);
  assert.equal(state.dragon.phase, 'patrol');
  assert.deepEqual(state.dragon.cells, []);
  assert.deepEqual(state.monsters.map(m => [m.x, m.y]), spawns);
  assert.equal(state.effects.length, 0);
  assert.equal(state.lives, 3);
  game.pause();
  const paused = { ...state.dragon };
  game.update(9);
  assert.deepEqual(state.dragon, paused);
});

test('a dragon pass marks three separated floor cells, then leaves three lingering, avoidable clouds', () => {
  const { game, state } = dragonEncounter();
  const targets = state.dragon.cells.map(cell => [...cell]);
  assert.equal(targets.length, 3);
  assert.ok(targets.some(([x, y]) => x === 11 && y === 13));
  assert.equal(state.effects.length, 0);
  assert.ok(state.dragon.windup > 1);
  // A normal turn takes the player off the flight path before the first cloud.
  game.turn('up');
  game.update(2 / 3.8);
  assert.equal(state.player.y, 12); // One step up, then a wall.
  assert.deepEqual(state.dragon.cells, targets);
  const cloudCount = () => state.effects.filter(e => e.type === 'dragon_breath').length;
  advanceUntil(game, () => cloudCount() === 3);
  for (const [x, y] of targets) {
    assert.equal(state.map[y][x], '.');
    assert.ok(state.effects.some(e => e.type === 'dragon_breath' && e.x === x && e.y === y && e.remaining > 1));
  }
  game.pause();
  const remaining = state.effects.map(e => e.remaining);
  game.update(5);
  assert.deepEqual(state.effects.map(e => e.remaining), remaining);
  game.resume();
  game.update(3.1);
  assert.equal(cloudCount(), 0);
  assert.equal(state.lives, 3);
});

test('standing in dragon breath costs one life, clears hazards and returns to a safe respawn', () => {
  const { game, state } = dragonEncounter();
  advanceUntil(game, () => state.lives === 2);
  assert.equal(state.effects.length, 0);
  assert.equal(state.dragon.phase, 'patrol');
  assert.ok(state.invulnerable > 0);
  game.update(15);
  assert.equal(state.lives, 2);
  assert.equal(state.effects.length, 0);
});

test('invisibility or a shout cancels a dragon pass and clears the clouds already dropped', () => {
  for (const hero of ['mom', 'dad']) {
    const { game, state } = dragonEncounter(hero);
    place(state.player, 11, 12);
    advanceUntil(game, () => state.effects.some(e => e.type === 'dragon_breath'));
    assert.ok(game.activate());
    game.update(0.05);
    assert.deepEqual(state.dragon.cells, []);
    assert.equal(state.dragon.phase, 'patrol');
    assert.deepEqual(state.effects, []);
    assert.equal(state.lives, 3);
  }
});

test('two Endermen reserve different teleport destinations and keep away from the hero on landing', () => {
  const { game, state, monster } = encounter('end', 'enderman');
  place(state.player, 11, 13);
  const second = state.monsters.find(m => m.type === 'enderman' && m !== monster);
  second.skillCooldown = second.stun = 0;
  game.update(0.01);
  assert.ok(monster.aim && second.aim);
  assert.notDeepEqual(monster.aim, second.aim);
  const landing = [monster.aim.x, monster.aim.y];
  place(state.player, ...landing);
  game.update(0.91);
  assert.notDeepEqual([monster.x, monster.y], landing);
  assert.ok(Math.hypot(second.x - monster.x, second.y - monster.y) >= 1);
  assert.equal(state.lives, 3);
});

test('a shulker stays anchored while its slow bolt turns a corner once and temporarily lifts the hero', () => {
  const { game, state, monster } = encounter('end', 'shulker');
  place(monster, 7, 13);
  place(state.player, 10, 13);
  game.update(0.02);
  assert.ok(monster.windup > 0);
  assert.equal(monster.aim.dir, 'right');
  advanceUntil(game, () => state.effects.some(e => e.type === 'shulker_bolt'));
  const bolt = state.effects.find(e => e.type === 'shulker_bolt');
  place(state.player, 9, 12);
  advanceUntil(game, () => bolt.dir === 'up');
  assert.equal(bolt.x, 9);
  assert.equal(bolt.canTurn, false);
  advanceUntil(game, () => state.levitation > 0);
  assert.ok(state.slow > 0 && state.slow <= 1.5);
  assert.deepEqual([monster.x, monster.y], [7, 13]);
  assert.equal(state.lives, 3);
  game.update(1.6);
  assert.equal(state.levitation, 0);
  assert.equal(state.slow, 0);
});

test('a shulker bolt can be sidestepped, expires against a wall and the shell is safe to pass', () => {
  const { game, state, monster } = encounter('end', 'shulker');
  place(monster, 1, 5);
  place(state.player, 6, 5);
  game.update(0.02);
  assert.ok(monster.windup > 0);
  place(state.player, 2, 1);
  advanceUntil(game, () => state.effects.some(e => e.type === 'shulker_bolt'));
  advanceUntil(game, () => state.effects.length === 0);
  assert.equal(state.levitation, 0);
  place(state.player, monster.x, monster.y);
  game.update(0.05);
  assert.equal(state.lives, 3);
});

test('a blaze charges, shoots two separate flames across lava and can be dodged', () => {
  const { game, state, monster } = acrossLava('blaze');
  game.update(0.02);
  assert.ok(monster.windup > 0);
  place(state.player, 12, 7);
  advanceUntil(game, () => state.effects.length > 0);
  const [first, second] = state.effects;
  assert.equal(first.type, 'ember');
  assert.equal(second.type, 'ember');
  assert.ok(first.x > second.x && second.delay > 0);
  game.update(0.29);
  assert.equal(state.map[Math.round(first.y)][Math.round(first.x)], '~');
  assert.equal(second.x, 9);
  game.update(0.25);
  assert.ok(second.x > 9);
  game.update(1.2);
  assert.ok(state.effects.every(e => e.type !== 'ember'));
  assert.equal(state.lives, 3);

  const target = acrossLava('blaze');
  advanceUntil(target.game, () => target.state.lives === 2);
  assert.equal(target.state.effects.length, 0);
});

test('a wither skeleton marks two corridor tiles before a slash that slows the hero', () => {
  const { game, state, monster } = encounter('nether', 'wither_skeleton');
  place(monster, 3, 13);
  place(state.player, 5, 13);
  game.update(0.02);
  assert.ok(monster.windup > 0);
  assert.deepEqual(monster.cells, [[4, 13], [5, 13]]);
  assert.equal(state.slow, 0);
  advanceUntil(game, () => state.effects.some(e => e.type === 'wither_slash'));
  assert.ok(state.slow > 0);
  assert.equal(state.lives, 3);
  place(state.player, 1, 13);
  game.update(1.01);
  assert.equal(state.slow, 0);
});
