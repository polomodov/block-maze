import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from '../engine.js';
import { LEVELS } from '../levels.js';

for (const [id, level] of Object.entries(LEVELS)) {
  test(id + ' connects every walkway, emerald and monster patrol', () => {
    const { state } = createGame('kirill', id);
    const visited = new Set();
    const queue = [level.start];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      const key = y * state.width + x;
      if (visited.has(key)) continue;
      visited.add(key);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (state.map[ny]?.[nx] === '.') queue.push([nx, ny]);
      }
    }
    const floorCount = state.map.join('').split('.').length - 1;
    assert.equal(visited.size, floorCount);
    for (const gem of state.gems) assert.ok(visited.has(gem));
    for (const { start, patrol } of level.monsters) {
      for (const [x, y] of [start, patrol]) assert.ok(visited.has(y * state.width + x));
    }
    for (const bounds of level.decorations) {
      for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
        for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
          assert.equal(state.map[y][x], '#');
        }
      }
    }
  });
}

test('movement can reverse between tiles and queue a turn before a junction', () => {
  const game = createGame();
  const { player } = game.state;
  game.start();
  game.turn('right');
  game.update(0.1);
  assert.ok(player.x > 11 && player.x < 12);
  game.turn('left');
  game.update(0.1);
  assert.equal(player.x, 11);
  game.turn('right');
  game.update(0.4);
  game.turn('down');
  game.update(0.8);
  assert.equal(player.x, 15);
  assert.ok(player.y > 11 && player.y < 12);
});

test('Kirill accelerates and a pause freezes the 30-second cooldown', () => {
  const game = createGame('kirill');
  assert.equal(game.activate(), false);
  game.start();
  assert.ok(game.activate());
  assert.equal(game.state.boost, 4);
  game.turn('right');
  game.update(0.25);
  assert.ok(game.state.player.x > 12);
  game.pause();
  game.update(30);
  assert.equal(game.state.cooldown.toFixed(2), '29.75');
  game.resume();
  game.update(29.74);
  assert.equal(game.activate(), false);
  game.update(0.01);
  assert.ok(game.activate());
});

test('Maxim stuns a nearby monster and leaves a distant one moving', () => {
  const game = createGame('maxim');
  game.start();
  const [near, far] = game.state.monsters;
  near.x = game.state.player.x + 1;
  near.y = game.state.player.y;
  assert.ok(game.activate());
  assert.equal(near.stun, 4);
  assert.equal(far.stun, 0);
  game.turn('right');
  game.update(0.25);
  assert.equal(game.state.lives, 3);
  assert.equal(near.x, 12);
  assert.ok(far.x !== 21 || far.y !== 1);
  assert.equal(game.activate(), false);
});

test('hits cost one life each and respawning preserves collected gems', () => {
  const game = createGame();
  game.start();
  game.turn('right');
  game.update(1 / 3.8);
  assert.equal(game.state.collected, 1);
  for (let lives = 2; lives >= 0; lives--) {
    const { state } = game;
    const monster = state.monsters.find(m => m.type === 'zombie');
    Object.assign(monster, { x: state.player.x, y: state.player.y, target: null });
    game.turn('right');
    game.update(1 / 60);
    assert.equal(state.lives, lives);
    assert.equal(state.collected, 1);
    if (lives) {
      assert.equal(state.invulnerable, 2);
      game.update(2);
    }
  }
  assert.equal(game.state.status, 'lost');
  const time = game.state.time;
  game.update(10);
  assert.equal(game.state.time, time);
});

test('collecting the final emerald wins and freezes the game', () => {
  const game = createGame();
  const { state } = game;
  const last = state.player.y * state.width + state.player.x + 1;
  state.gems.clear();
  state.gems.add(last);
  state.collected = state.totalGems - 1;
  game.start();
  game.turn('right');
  game.update(1);
  assert.equal(state.status, 'won');
  assert.equal(state.collected, state.totalGems);
  assert.equal(state.gems.size, 0);
  assert.equal(game.activate(), false);
});

test('invisible Mom can collect gems while the creeper heads to patrol', () => {
  // In this corridor the patrol lies to the left and the visible player to the right.
  for (const invisible of [false, true]) {
    const game = createGame('mom');
    game.start();
    Object.assign(game.state.player, { x: 13, y: 11 });
    const creeper = game.state.monsters[0];
    Object.assign(creeper, { x: 10, y: 11 });
    if (invisible) game.activate();
    game.turn('right');
    game.update(0.1);
    assert.equal(creeper.dir, invisible ? 'left' : 'right');
    game.update(0.55);
    assert.ok(game.state.collected > 0);
  }
});

test('Dad sends a chasing monster back immediately and an escaping monster keeps going', () => {
  const game = createGame('dad');
  game.start();
  const [chasing, escaping] = game.state.monsters;
  Object.assign(chasing, { x: 12.5, y: 11, dir: 'left', target: [12, 11] });
  Object.assign(escaping, { x: 9.5, y: 11, dir: 'left', target: [9, 11] });
  assert.ok(game.activate());
  assert.equal(chasing.dir, 'right');
  assert.equal(escaping.dir, 'left');
  game.update(0.75);
  assert.ok(chasing.x > 13);
  assert.ok(escaping.x < 9);
});

for (const [hero, effect, duration] of [['mom', 'invisible', 4], ['dad', 'fear', 3]]) {
  test(hero + ' is safe for the exact effect duration and pauses freeze the clock', () => {
    const game = createGame(hero);
    const { state } = game;
    game.start();
    game.activate();
    assert.equal(state[effect], duration);
    game.pause();
    game.update(10);
    assert.equal(state[effect], duration);
    assert.equal(state.cooldown, 30);
    game.resume();
    game.turn('right');
    game.update(duration - 0.02);
    const monster = state.monsters.find(m => m.type === 'zombie');
    Object.assign(monster, { x: state.player.x, y: state.player.y, dir: null, target: null });
    game.update(0.01);
    assert.equal(state.lives, 3);
    game.update(0.01);
    assert.equal(state[effect], 0);
    assert.equal(state.lives, 2);
    assert.equal(game.activate(), false);
    game.update(30 - duration);
    assert.ok(game.activate());
  });
}

test('the full campaign carries remaining lives and cooldown into each next level', () => {
  const game = createGame('mom');
  const { state } = game;
  assert.equal(game.nextLevel(), false);
  game.start();
  state.lives = 2;
  game.activate();
  function collectLast() {
    state.gems.clear();
    state.gems.add(state.player.y * state.width + state.player.x + 1);
    state.collected = state.totalGems - 1;
    game.turn('right');
    game.update(1);
    assert.equal(state.status, 'won');
  }
  for (const next of ['arcade', 'waterpark', 'store', 'nether', 'castle', 'end']) {
    collectLast();
    const cooldown = state.cooldown;
    assert.ok(game.nextLevel());
    assert.equal(state.levelId, next);
    assert.equal(state.status, 'playing');
    assert.equal(state.hero, 'mom');
    assert.equal(state.lives, 2);
    assert.equal(state.cooldown, cooldown);
    assert.equal(state.invisible, 0);
    assert.equal(state.collected, 0);
    assert.equal(state.gems.size, state.totalGems);
    assert.deepEqual(state.monsters.map(m => m.type), LEVELS[next].monsters.map(m => m.type));
    assert.equal(game.nextLevel(), false);
  }
  collectLast();
  assert.equal(game.nextLevel(), false);
  assert.equal(state.status, 'won');
});

test('Typhoon accepts a queued turn, pauses mid-ride and collects at the far exit', () => {
  const game = createGame('maxim', 'waterpark');
  const { state } = game;
  const { entry, exit, direction, duration } = state.ride;
  game.start();
  Object.assign(state.player, { x: entry[0] - 1, y: entry[1] });
  game.turn('right');
  game.update(0.1);
  game.turn(direction);
  game.update(0.2);
  assert.ok(state.rideRemaining > 0);
  assert.equal(game.activate(), false);
  game.pause();
  const remaining = state.rideRemaining;
  game.update(3);
  assert.equal(state.rideRemaining, remaining);
  game.resume();
  const exitGem = exit[1] * state.width + exit[0];
  state.gems.add(exitGem);
  game.update(duration);
  assert.equal(state.rideRemaining, 0);
  assert.deepEqual([state.player.x, state.player.y], exit);
  assert.ok(!state.gems.has(exitGem));
  game.update(0.1);
  assert.equal(state.rideRemaining, 0);
});

test('Typhoon lets the hero walk past and checks monster contact upon landing', () => {
  const game = createGame('kirill', 'waterpark');
  const { state } = game;
  const { entry, exit, direction, duration } = state.ride;
  game.start();
  Object.assign(state.player, { x: entry[0] - 1, y: entry[1] });
  game.turn('right');
  game.update(2 / 3.8);
  assert.equal(state.rideRemaining, 0);
  assert.equal(state.player.x, entry[0] + 1);
  Object.assign(state.player, { x: entry[0], y: entry[1], dir: null, target: null });
  game.turn(direction);
  game.update(duration - 0.01);
  assert.equal(state.lives, 3);
  Object.assign(state.monsters[0], { x: exit[0], y: exit[1], dir: null, target: null });
  game.update(0.01);
  assert.equal(state.lives, 2);
  assert.equal(state.rideRemaining, 0);
});

test('Pasha plays without a target and the next solo is ready after 30 active seconds', () => {
  const game = createGame('pasha');
  const { state } = game;
  assert.equal(game.activate(), false);
  game.start();
  assert.ok(game.activate());
  assert.equal(state.solo.front, 1);
  assert.equal(state.cooldown, 30);
  assert.equal(state.monsters.every(monster => monster.dance === 0), true);
  game.update(0.2);
  game.pause();
  const age = state.solo.age;
  game.update(31);
  assert.equal(state.solo.age, age);
  assert.ok(!game.activate());
  game.resume();
  game.update(29.79);
  assert.equal(state.solo, null);
  assert.ok(!game.activate());
  game.update(0.01);
  assert.ok(game.activate());
});

test('the first chord saves Pasha in a close chase and he can collect emeralds through the dancers', () => {
  const game = createGame('pasha');
  const { state } = game;
  game.start();
  game.turn('right');
  game.update(0.1);
  const zombie = state.monsters.find(monster => monster.type === 'zombie');
  Object.assign(zombie, { x: state.player.x + 0.6, y: state.player.y, target: null });
  const x = zombie.x;
  assert.ok(game.activate());
  assert.equal(zombie.dance, 5);
  game.update(0.3);
  assert.equal(zombie.x, x);
  assert.ok(state.player.x > zombie.x);
  assert.equal(state.lives, 3);
  assert.ok(state.collected > 0);
  game.pause();
  const dance = zombie.dance;
  game.update(1);
  assert.equal(zombie.dance, dance);
});

test('notes travel round walls in 0.6 seconds, stop at six steps and a dancer recovers exactly once', () => {
  const game = createGame('pasha');
  const { state } = game;
  game.start();
  Object.assign(state.player, { x: 5, y: 3 });
  const [aroundWall, near, outside] = state.monsters;
  Object.assign(near, { x: 5, y: 2 });
  Object.assign(aroundWall, { x: 7, y: 3 });
  Object.assign(outside, { x: 8, y: 3 });
  assert.ok(game.activate());
  assert.equal(near.dance, 5);
  assert.equal(aroundWall.dance, 0);
  assert.ok(state.solo.cells.every(([x,y]) => state.map[y][x] === '.'));
  assert.deepEqual(state.solo.cells.find(([x,y]) => x === 7 && y === 3), [7,3,6]);
  game.update(0.59);
  assert.equal(aroundWall.dance, 0);
  game.update(0.01);
  assert.equal(aroundWall.dance, 5);
  game.update(4.4);
  assert.equal(near.dance, 0);
  assert.equal(outside.dance, 0);
  assert.ok(Math.abs(aroundWall.dance - 0.6) < 1e-8);
  game.update(0.6);
  assert.equal(aroundWall.dance, 0);
  // After the music ends, touching a dancer again costs a life.
  Object.assign(state.player, { x: near.x, y: near.y });
  game.turn('down');
  game.update(1 / 60);
  assert.equal(state.lives, 2);
});

test('the solo cancels a warned attack but a previously launched projectile still hits Pasha', () => {
  const game = createGame('pasha', 'arcade');
  const { state } = game;
  game.start();
  Object.assign(state.player, { x: 8, y: 1 });
  const skeleton = state.monsters.find(monster => monster.type === 'skeleton');
  Object.assign(skeleton, { x: 9, y: 1, windup: 0.05, aim: { dir: 'left' } });
  const owner = state.monsters.indexOf(skeleton);
  state.effects.push({ type: 'arrow', x: 8.55, y: 1, dir: 'left', owner, remaining: 0.5 });
  assert.ok(game.activate());
  assert.equal(skeleton.dance, 5);
  assert.equal(skeleton.windup, 0);
  assert.equal(skeleton.aim, null);
  game.turn('right');
  game.update(0.1);
  assert.equal(state.lives, 2);
  assert.equal(state.solo, null);
  assert.equal(state.monsters.every(monster => monster.dance === 0), true);
  assert.ok(state.cooldown > 29);
});

test('Pasha can reach the next level during a solo and carries his cooldown', () => {
  const game = createGame('pasha');
  const { state } = game;
  game.start();
  state.gems = new Set([state.width * state.player.y + state.player.x + 1]);
  game.activate();
  game.turn('right');
  game.update(0.3);
  assert.equal(state.status, 'won');
  assert.ok(game.nextLevel());
  assert.equal(state.hero, 'pasha');
  assert.equal(state.solo, null);
  assert.ok(state.cooldown > 29);
  assert.ok(!game.activate());
});

test('a dancing shulker drops its aim while dragon breath stays dangerous in the same corridor', () => {
  const game = createGame('pasha', 'end');
  const { state } = game;
  const shulker = state.monsters.find(monster => monster.type === 'shulker');
  game.start();
  Object.assign(state.player, { x: 11, y: 13 });
  Object.assign(shulker, { x: 12, y: 13, windup: 0.1, aim: { dir: 'left' } });
  state.effects.push({ type: 'dragon_breath', x: 11, y: 13, remaining: 2 });
  assert.ok(game.activate());
  assert.equal(shulker.dance, 5);
  assert.equal(shulker.windup, 0);
  game.turn('right');
  game.update(0.04);
  assert.equal(state.lives, 2);
  assert.equal(state.solo, null);
});
