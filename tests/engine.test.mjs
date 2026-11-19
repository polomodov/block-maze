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

test('Pasha vaults over a moving zombie, pauses in midair and collects only at the landing', () => {
  const game = createGame('pasha');
  const { state } = game;
  assert.equal(state.hero, 'pasha');
  game.start();
  Object.assign(state.player, { x: 11, y: 13 });
  const zombie = state.monsters.find(m => m.type === 'zombie');
  Object.assign(zombie, { x: 12, y: 13 });
  state.gems.add(13 * state.width + 13);
  game.turn('right');
  game.update(0.035);
  assert.ok(state.player.x > 11);
  assert.ok(game.activate());
  assert.equal(state.cooldown, 30);
  assert.deepEqual([state.vault.toX, state.vault.toY], [13, 13]);
  game.update(0.15);
  assert.ok(state.vault.progress > 0 && state.vault.progress < 1);
  assert.equal(state.lives, 3);
  game.pause();
  const progress = state.vault.progress;
  game.update(2);
  assert.equal(state.vault.progress, progress);
  game.resume();
  game.update(0.2);
  assert.equal(state.vault, null);
  assert.equal(state.player.x, 13);
  assert.equal(state.lives, 3);
  assert.equal(zombie.stun, 0);
  assert.ok(state.gems.has(13 * state.width + 12));
  assert.ok(!state.gems.has(13 * state.width + 13));
  assert.ok(!game.activate());
});

test('Pasha needs a monster ahead, an open corridor and a free landing to spend a charge', () => {
  const game = createGame('pasha');
  const { state } = game;
  game.start();
  for (const [x, y, middleOccupied, landingOccupied] of [
    [11,13,false,false], [11,13,true,true], [4,3,true,false], [5,3,true,false],
  ]) {
    Object.assign(state.player, { x, y });
    Object.assign(state.monsters[0], { x: middleOccupied ? x + 1 : 1, y });
    Object.assign(state.monsters[1], { x: landingOccupied ? x + 2 : 1, y });
    game.turn('right');
    assert.equal(game.activate(), false);
    assert.equal(state.cooldown, 0);
    assert.equal(state.vault, null);
    assert.equal(state.player.x, x);
  }
});

test('Pasha can jump straight up a corridor and can win by landing on the last emerald', () => {
  const game = createGame('pasha');
  const { state } = game;
  game.start();
  Object.assign(state.player, { x: 1, y: 3 });
  Object.assign(state.monsters[0], { x: 1, y: 2 });
  Object.assign(state.monsters[1], { x: 17, y: 1 });
  state.gems = new Set([state.width + 1]);
  game.turn('up');
  assert.ok(game.activate());
  game.update(0.36);
  assert.equal(state.status, 'won');
  assert.deepEqual([state.player.x, state.player.y], [1,1]);
  assert.ok(game.nextLevel());
  assert.equal(state.hero, 'pasha');
  assert.equal(state.vault, null);
  assert.ok(state.cooldown > 29);
});
