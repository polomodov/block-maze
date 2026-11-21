import test from 'node:test';
import assert from 'node:assert/strict';
import { carve, distances, planMaze, random, formatTicks, SIZES } from '../src/maze.ts';

test('the same seed gives the same maze', () => {
  assert.deepEqual(planMaze('medium', 42), planMaze('medium', 42));
  assert.notDeepEqual(planMaze('medium', 42).wall, planMaze('medium', 43).wall);
});

test('every room is reachable and the maze is perfect', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const cells = 9;
    const wall = carve(cells, random(seed));
    const size = wall.length;
    const dist = distances(wall, { x: 1, z: 1 });
    let open = 0;
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
      if (x === 0 || z === 0 || x === size - 1 || z === size - 1) assert.equal(wall[z][x], true, 'border stays closed');
      if (!wall[z][x]) { open++; assert.ok(dist[z][x] >= 0, 'open block reachable'); }
    }
    // A perfect maze is a tree: rooms + passages = 2 * rooms - 1.
    assert.equal(open, 2 * cells * cells - 1);
  }
});

test('plan places emeralds, monsters and finish on distinct open rooms', () => {
  for (const size of Object.keys(SIZES)) {
    for (let seed = 1; seed <= 30; seed++) {
      const plan = planMaze(size, seed);
      const keys = [plan.start, plan.finish, ...plan.emeralds, ...plan.monsters].map(c => c.x + ',' + c.z);
      assert.equal(new Set(keys).size, keys.length, 'no overlaps');
      for (const c of [plan.finish, ...plan.emeralds, ...plan.monsters]) assert.equal(plan.wall[c.z][c.x], false);
      assert.equal(plan.emeralds.length, SIZES[size].emeralds);
      assert.equal(plan.monsters.length, SIZES[size].monsters);
    }
  }
});

test('monsters start in the far half of the maze', () => {
  const plan = planMaze('large', 7);
  const dist = distances(plan.wall, plan.start);
  const longest = dist[plan.finish.z][plan.finish.x];
  for (const m of plan.monsters) assert.ok(dist[m.z][m.x] * 2 >= longest);
});

test('formatTicks', () => {
  assert.equal(formatTicks(0), '0:00');
  assert.equal(formatTicks(20 * 75), '1:15');
});
