import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, restoreGame } from '../engine.js';
import { LEVELS } from '../levels.js';

const throughStorage = value => JSON.parse(JSON.stringify(value));

test('reloading restores every maze’s gems, held turn, monster state and clocks before resuming', () => {
  for (const id of Object.keys(LEVELS)) {
    const original = createGame('pasha', id);
    original.start();
    original.turn('right');
    original.update(.21);
    original.turn('up');
    assert.equal(original.activate(), true);
    original.update(.1);
    const save = throughStorage(original.snapshot());
    const restored = restoreGame(save);
    assert.equal(restored.state.status, 'paused');
    restored.update(120);
    assert.deepEqual(restored.snapshot(), original.snapshot());
    restored.resume();
    for (const dir of ['down', 'left', 'up', 'right', 'down']) {
      for (const game of [original, restored]) {
        game.turn(dir);
        game.update(.87);
      }
      assert.deepEqual(restored.state, original.state);
    }
  }
});

test('a completed maze saves its successor with carried progress without changing the victory screen', () => {
  const game = createGame('mom');
  game.start();
  game.activate();
  game.state.lives = 2;
  game.state.status = 'won';
  const next = game.nextSnapshot();
  assert.equal(game.snapshot(), null);
  assert.equal(game.state.status, 'won');
  const restored = restoreGame(throughStorage(next));
  assert.ok(restored);
  assert.ok(game.nextLevel());
  restored.resume();
  assert.deepEqual(restored.state, game.state);
  const end = createGame('kirill', 'end');
  end.state.status = 'won';
  assert.equal(end.nextSnapshot(), null);
});

test('unsupported or incomplete maze saves cannot replace a run', () => {
  const game = createGame('dad', 'end'); game.start();
  const change = fn => { const s = game.snapshot(); fn(s); return s; };
  for (const save of [null, {}, change(s => s.version++), change(s => s.hero = 'missing'),
    change(s => s.level = 'bad'), change(s => s.progress.player.target = [0, 0]),
    change(s => s.progress.monsters.pop()), change(s => s.progress.gems = [-1]),
    change(s => { s.progress.dragon.phase = 'breathing'; s.progress.dragon.cells = []; }),
    change(s => s.progress.effects = [{x: 1, y: 1, type: 'arrow', remaining: 1, dir: 'bad'}])]) {
    assert.equal(restoreGame(save), null);
  }
});

test('saving during a lava jump or dragon breath resumes the same encounter', () => {
  for (const level of ['nether', 'end']) {
    const game = createGame('kirill', level);
    game.start();
    game.turn('right');
    game.update(.01);
    const { state } = game;
    const place = (actor, x, y) => Object.assign(actor, { x, y, dir: null, target: null });
    state.invulnerable = 25;
    state.monsters.forEach(m => m.stun = 25);
    if (level === 'nether') {
      const cube = state.monsters.find(m => m.type === 'magma_cube');
      place(cube, 9, 6);
      place(state.player, 12, 6);
      cube.stun = cube.skillCooldown = 0;
      game.update(.9);
      assert.ok(cube.leap?.progress > 0);
    } else {
      place(state.player, 11, 13);
      for (let i = 0; i < 500 && !state.effects.length; i++) game.update(1 / 60);
      assert.equal(state.dragon.phase, 'breathing');
      assert.equal(state.effects[0].type, 'dragon_breath');
    }
    const restored = restoreGame(throughStorage(game.snapshot()));
    assert.ok(restored);
    restored.resume();
    for (const g of [game, restored]) g.update(.8);
    assert.deepEqual(restored.state, state);
  }
});
