// Pure maze logic. No Minecraft imports, so it runs under plain Node tests.

export type Cell = { x: number; z: number };

export type MazePlan = {
  /** Grid size in blocks, always odd: 2 * cells + 1. */
  size: number;
  /** wall[z][x] is true where a wall column stands. */
  wall: boolean[][];
  start: Cell;
  finish: Cell;
  emeralds: Cell[];
  monsters: Cell[];
};

export type MazeSize = 'small' | 'medium' | 'large';

export const SIZES: Record<MazeSize, { cells: number; emeralds: number; monsters: number; label: string }> = {
  small: { cells: 7, emeralds: 6, monsters: 0, label: 'Маленький' },
  medium: { cells: 11, emeralds: 12, monsters: 2, label: 'Средний' },
  large: { cells: 15, emeralds: 20, monsters: 4, label: 'Большой' },
};

/** Small seeded PRNG (mulberry32), so a seed always gives the same maze. */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rnd: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

const STEPS = [
  { x: 2, z: 0 },
  { x: -2, z: 0 },
  { x: 0, z: 2 },
  { x: 0, z: -2 },
];

/** Carves a perfect maze (one path between any two cells) with an iterative backtracker. */
export function carve(cells: number, rnd: () => number): boolean[][] {
  const size = cells * 2 + 1;
  const wall = Array.from({ length: size }, () => new Array<boolean>(size).fill(true));
  const stack: Cell[] = [{ x: 1, z: 1 }];
  wall[1][1] = false;
  while (stack.length) {
    const here = stack.at(-1)!;
    const next = shuffle(STEPS.slice(), rnd)
      .map(s => ({ x: here.x + s.x, z: here.z + s.z, s }))
      .find(n => n.x > 0 && n.z > 0 && n.x < size - 1 && n.z < size - 1 && wall[n.z][n.x]);
    if (!next) {
      stack.pop();
      continue;
    }
    wall[here.z + next.s.z / 2][here.x + next.s.x / 2] = false;
    wall[next.z][next.x] = false;
    stack.push({ x: next.x, z: next.z });
  }
  return wall;
}

/** Steps from `from` to every open block, -1 for walls and unreachable blocks. */
export function distances(wall: boolean[][], from: Cell): number[][] {
  const size = wall.length;
  const dist = Array.from({ length: size }, () => new Array<number>(size).fill(-1));
  dist[from.z][from.x] = 0;
  const queue: Cell[] = [from];
  // for...of keeps visiting cells pushed during the loop, which is what BFS needs.
  for (const c of queue) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c.x + dx, z = c.z + dz;
      if (x < 0 || z < 0 || x >= size || z >= size || wall[z][x] || dist[z][x] >= 0) continue;
      dist[z][x] = dist[c.z][c.x] + 1;
      queue.push({ x, z });
    }
  }
  return dist;
}

function openNeighbours(wall: boolean[][], c: Cell): number {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => !wall[c.z + dz][c.x + dx]).length;
}

/**
 * Builds a full level: the start is the top-left cell, the finish is the cell
 * farthest from it, emeralds go to dead ends first, and monsters start in the
 * far half of the maze so the player has a moment to look around.
 */
export function planMaze(size: MazeSize, seed: number): MazePlan {
  const rules = SIZES[size];
  const rnd = random(seed);
  const wall = carve(rules.cells, rnd);
  const start = { x: 1, z: 1 };
  const dist = distances(wall, start);

  const rooms: Cell[] = [];
  for (let z = 1; z < wall.length; z += 2) for (let x = 1; x < wall.length; x += 2) rooms.push({ x, z });
  const finish = rooms.reduce((best, c) => (dist[c.z][c.x] > dist[best.z][best.x] ? c : best), start);
  const longest = dist[finish.z][finish.x];

  const free = rooms.filter(c => !(c.x === start.x && c.z === start.z) && !(c.x === finish.x && c.z === finish.z));
  const deadEnds = shuffle(free.filter(c => openNeighbours(wall, c) === 1), rnd);
  const others = shuffle(free.filter(c => openNeighbours(wall, c) !== 1), rnd);
  const emeralds = [...deadEnds, ...others].slice(0, rules.emeralds);

  const taken = new Set(emeralds.map(c => c.x + ',' + c.z));
  const far = shuffle(free.filter(c => dist[c.z][c.x] * 2 >= longest && !taken.has(c.x + ',' + c.z)), rnd);
  const monsters = far.slice(0, rules.monsters);

  return { size: wall.length, wall, start, finish, emeralds, monsters };
}

/** Formats ticks (20 per second) as m:ss. */
export function formatTicks(ticks: number): string {
  const seconds = Math.floor(ticks / 20);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
