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
