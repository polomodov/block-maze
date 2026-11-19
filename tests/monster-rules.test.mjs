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
  place(state.player, 7, 13);
  const monster = state.monsters.find(actor => actor.type === type);
  // Isolate the ability being exercised from unrelated contact damage.
  for (const actor of state.monsters) {
    if (actor !== monster) actor.stun = 100;
  }
  place(monster, 10, 13);
  monster.skillCooldown = 0;
  return { game, state, monster };
}

function until(game, predicate, seconds, description) {
  for (let tick = 0; tick < Math.ceil(seconds * 60); tick++) {
    game.update(1 / 60);
    if (predicate()) return;
  }
  assert.fail(description);
}

test('waiting for the first move keeps monster abilities dormant', () => {
  for (const level of ['temple', 'arcade', 'waterpark', 'store', 'nether', 'castle', 'end']) {
    const game = createGame('kirill', level);
    game.start();
    for (const monster of game.state.monsters) {
      place(monster, game.state.player.x + 1, game.state.player.y);
      monster.skillCooldown = 0;
    }
    game.update(15);
    assert.equal(game.state.lives, 3);
    assert.equal(game.state.effects.length, 0);
    assert.ok(game.state.monsters.every(monster => !monster.windup));
  }
});

test('a primed creeper explodes after its warning, damages a neighbour and respawns', () => {
  const { game, state, monster } = encounter('temple', 'creeper');
  place(monster, 8, 13);
  until(game, () => monster.windup > 0, 0.1, 'no fuse');
  assert.equal(state.lives, 3);
  game.pause();
  const fuse = monster.windup;
  game.update(3);
  assert.equal(monster.windup, fuse);
  game.resume();
  until(game, () => state.lives < 3, 2, 'adjacent blast missed');
  assert.equal(state.lives, 2);
  assert.deepEqual([state.monsters[0].x, state.monsters[0].y], [1, 1]);
});

test('escaping a primed creeper around a wall leaves the player unharmed', () => {
  const { game, state, monster } = encounter('temple', 'creeper');
  place(monster, 5, 3);
  place(state.player, 4, 3);
  until(game, () => monster.windup > 0, 0.1, 'no fuse');
  place(state.player, 7, 3);
  until(game, () => state.effects.some(effect => effect.type === 'blast'), 2, 'no explosion');
  assert.equal(state.lives, 3);
  assert.deepEqual([Math.round(monster.x), Math.round(monster.y)], [1, 1]);
});

test('an arrow follows its firing line and costs a life on contact', () => {
  const { game, state, monster } = encounter('store', 'skeleton');
  until(game, () => monster.windup > 0, 0.1, 'skeleton did not aim');
  until(game, () => state.effects.some(effect => effect.type === 'arrow'), 2, 'no shot');
  assert.equal(state.lives, 3);
  until(game, () => state.lives < 3, 1.5, 'arrow did not hit');
  assert.equal(state.lives, 2);
});

test('a wall blocks the skeleton’s line of sight', () => {
  const { game, state, monster } = encounter('store', 'skeleton');
  place(monster, 9, 2);
  place(state.player, 11, 2);
  assert.equal(state.map[2][10], '#');
  game.update(0.1);
  assert.equal(monster.windup, 0);
  assert.equal(state.effects.length, 0);
});

test('Mom can turn invisible while an arrow is in flight', () => {
  const { game, state } = encounter('store', 'skeleton', 'mom');
  until(game, () => state.effects.some(effect => effect.type === 'arrow'), 2, 'no shot');
  assert.ok(game.activate());
  game.update(1.5);
  assert.equal(state.lives, 3);
  assert.ok(state.invisible > 0);
});

test('the witch’s puddle slows the player without taking a life, then expires', () => {
  const { game, state, monster } = encounter('store', 'witch');
  const pool = () => state.effects.find(effect => effect.type === 'slow_pool');
  until(game, () => pool(), 3, 'no puddle');
  const { x, y } = pool();
  place(monster, 1, 1);
  monster.skillCooldown = 100;
  place(state.player, x, y);
  game.update(0.1);
  assert.ok(state.slow > 0);
  assert.equal(state.lives, 3);
  game.update(6);
  assert.equal(pool(), undefined);
  assert.equal(state.slow, 0);
});

test('the enderman signals a teleport and lands on an open tile away from the player', () => {
  const { game, state, monster } = encounter('store', 'enderman');
  place(monster, 20, 13);
  until(game, () => monster.windup > 0, 1, 'no teleport warning');
  const start = [monster.x, monster.y];
  until(game, () => Math.hypot(monster.x - start[0], monster.y - start[1]) > 2, 2, 'no teleport');
  const x = Math.round(monster.x);
  const y = Math.round(monster.y);
  assert.equal(state.map[y][x], '.');
  assert.notDeepEqual([x, y], [state.player.x, state.player.y]);
  assert.ok(Math.abs(x - state.player.x) + Math.abs(y - state.player.y) < 13);
  assert.equal(state.lives, 3);
});

test('the skeleton does not start aiming a shot from five cells away', () => {
  const { game, monster, state } = encounter('store', 'skeleton');
  place(monster, 12, 13);
  game.update(0.05);
  assert.equal(monster.windup, 0);
  assert.equal(state.effects.length, 0);
});

test('the enderman cancels a teleport if the hero moves onto the marked tile', () => {
  const { game, state, monster } = encounter('store', 'enderman');
  place(monster, 20, 13);
  until(game, () => monster.windup > 0, 1, 'no teleport warning');
  const start = [monster.x, monster.y];
  place(state.player, monster.aim.x, monster.aim.y);
  until(game, () => !monster.windup, 2, 'warning did not finish');
  assert.deepEqual([monster.x, monster.y], start);
  assert.equal(state.lives, 3);
});
