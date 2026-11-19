import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from '../engine.js';

test('all emeralds are reachable from the starting tile', () => {
  const { state } = createGame();
  const visited = new Set();
  const queue = [[state.player.x, state.player.y]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    const key = y * state.width + x;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (state.map[ny]?.[nx] === '.') queue.push([nx, ny]);
    }
  }
  for (const gem of state.gems) assert.ok(visited.has(gem));
});

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
    const monster = state.monsters[0];
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
