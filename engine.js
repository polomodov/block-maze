// Positions use tile centers as integer coordinates. All clocks use active game seconds.
const MAP = Object.freeze([
  '#######################',
  '#.....................#',
  '#.###.###.###.###.###.#',
  '#.....#...###...#.....#',
  '###.#.#.#.###.#.#.#.###',
  '#...#...#.....#...#...#',
  '#.#####.##.#.##.#####.#',
  '#.......#.....#.......#',
  '#.###.#.#.#.#.#.#.###.#',
  '#...#.#.........#.#...#',
  '###.#.###.###.###.#.###',
  '#.....#.........#.....#',
  '#.###.#.#######.#.###.#',
  '#.....................#',
  '#######################',
]);

const WIDTH = MAP[0].length;
const STEPS = {
  left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1],
};
const REVERSE = { left: 'right', right: 'left', up: 'down', down: 'up' };
const PLAYER_START = [11, 11];
const BEASTS = [
  { type: 'creeper', start: [1, 1], patrol: [1, 13], speed: 2.30 },
  { type: 'zombie', start: [21, 1], patrol: [21, 13], speed: 2.05 },
  { type: 'spider', start: [11, 5], patrol: [11, 1], speed: 2.60 },
];

const tileKey = (x, y) => y * WIDTH + x;
const isFloor = (x, y) => MAP[y]?.[x] === '.';

function exits(x, y) {
  return Object.keys(STEPS).filter(dir => {
    const [dx, dy] = STEPS[dir];
    return isFloor(x + dx, y + dy);
  });
}

// Monsters compare corridor distances at junctions. Each target field is reusable.
const fields = new Map();
function distancesFrom(x, y) {
  const key = tileKey(x, y);
  if (fields.has(key)) return fields.get(key);
  const distances = new Int16Array(WIDTH * MAP.length).fill(-1);
  distances[key] = 0;
  const queue = [[x, y]];
  for (let head = 0; head < queue.length; head++) {
    const [cx, cy] = queue[head];
    for (const dir of exits(cx, cy)) {
      const [dx, dy] = STEPS[dir];
      const next = tileKey(cx + dx, cy + dy);
      if (distances[next] !== -1) continue;
      distances[next] = distances[tileKey(cx, cy)] + 1;
      queue.push([cx + dx, cy + dy]);
    }
  }
  fields.set(key, distances);
  return distances;
}

function actor([x, y]) {
  return { x, y, dir: null, target: null };
}

// Finish each edge exactly at its tile center before choosing the next turn.
function move(actor, distance, choose, arrive) {
  while (distance > 1e-8) {
    if (!actor.target) {
      const dir = choose(actor, exits(actor.x, actor.y));
      if (!dir) {
        actor.dir = null;
        return;
      }
      actor.dir = dir;
      const [dx, dy] = STEPS[dir];
      actor.target = [actor.x + dx, actor.y + dy];
    }
    const [tx, ty] = actor.target;
    const remaining = Math.abs(tx - actor.x) + Math.abs(ty - actor.y);
    if (distance + 1e-8 < remaining) {
      const [dx, dy] = STEPS[actor.dir];
      actor.x += dx * distance;
      actor.y += dy * distance;
      return;
    }
    actor.x = tx;
    actor.y = ty;
    actor.target = null;
    distance -= remaining;
    if (arrive) arrive(tx, ty);
  }
}

function countdown(value, seconds) {
  return value <= seconds + 1e-8 ? 0 : value - seconds;
}

export function createGame(hero = 'kirill') {
  const gems = new Set();
  for (let y = 0; y < MAP.length; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (isFloor(x, y) && (x + y) % 2 === 1) gems.add(tileKey(x, y));
    }
  }
  const state = {
    hero: hero === 'maxim' ? 'maxim' : 'kirill',
    status: 'ready', map: MAP, width: WIDTH, height: MAP.length,
    player: null, monsters: [], gems, totalGems: gems.size, collected: 0, lives: 3,
    time: 0, cooldown: 0, boost: 0, attack: 0, invulnerable: 0,
  };
  let queued = null;
  let waiting = true;

  function resetPositions() {
    state.player = actor(PLAYER_START);
    state.monsters = BEASTS.map(beast => ({
      ...actor(beast.start), type: beast.type, stun: 0,
    }));
    queued = null;
    waiting = true;
  }
  resetPositions();

  function turn(dir) {
    if (state.status !== 'playing' || !Object.hasOwn(STEPS, dir)) return;
    const player = state.player;
    // A reversal can happen between tiles. Perpendicular turns wait for a junction.
    if (player.target && REVERSE[player.dir] === dir) {
      const [dx, dy] = STEPS[player.dir];
      player.target = [player.target[0] - dx, player.target[1] - dy];
      player.dir = dir;
      queued = null;
      return;
    }
    queued = dir;
  }

  function steerPlayer(player, options) {
    if (options.includes(queued)) {
      const dir = queued;
      queued = null;
      waiting = false;
      return dir;
    }
    return options.includes(player.dir) ? player.dir : null;
  }

  function steerMonster(monster, options, index) {
    if (options.length > 1) options = options.filter(dir => dir !== REVERSE[monster.dir]);
    const beast = BEASTS[index];
    let x = Math.round(state.player.x);
    let y = Math.round(state.player.y);
    // Patrol breaks open escape routes. The spider occasionally aims one tile ahead.
    if ((state.time + index * 3) % 19 > 13) {
      [x, y] = beast.patrol;
    } else if (beast.type === 'spider' && state.player.dir) {
      const [dx, dy] = STEPS[state.player.dir];
      if (isFloor(x + dx, y + dy)) {
        x += dx;
        y += dy;
      }
    }
    const distances = distancesFrom(x, y);
    function cost(dir) {
      const [dx, dy] = STEPS[dir];
      return distances[tileKey(monster.x + dx, monster.y + dy)];
    }
    return options.reduce((best, dir) => cost(dir) < cost(best) ? dir : best);
  }

  function collect(x, y) {
    if (!state.gems.delete(tileKey(x, y))) return;
    state.collected++;
    if (!state.gems.size) state.status = 'won';
  }

  function hitNearby() {
    for (const monster of state.monsters) {
      if (monster.stun > 0) continue;
      const dx = state.player.x - monster.x;
      const dy = state.player.y - monster.y;
      // Within this reach a one-tile wall cannot separate the two corridors.
      if (Math.abs(dx) + Math.abs(dy) <= 1.55) monster.stun = 4;
    }
  }

  function activate() {
    if (state.status !== 'playing' || state.cooldown > 0) return false;
    state.cooldown = 30;
    if (state.hero === 'kirill') {
      state.boost = 4;
    } else {
      state.attack = 0.32;
      hitNearby();
    }
    return true;
  }

  function step(seconds) {
    state.time += seconds;
    const speed = state.boost > 0 ? 6.2 : 3.8;
    state.cooldown = countdown(state.cooldown, seconds);
    state.boost = countdown(state.boost, seconds);
    state.invulnerable = countdown(state.invulnerable, seconds);
    move(state.player, seconds * speed, steerPlayer, collect);
    if (state.status === 'won') return;
    state.monsters.forEach((monster, index) => {
      if (monster.stun > 0) {
        monster.stun = countdown(monster.stun, seconds);
      } else if (!waiting) {
        move(monster, seconds * BEASTS[index].speed,
          (actor, options) => steerMonster(actor, options, index));
      }
    });
    if (state.attack > 0) hitNearby();
    state.attack = countdown(state.attack, seconds);
    if (waiting || state.invulnerable > 0) return;
    const touched = state.monsters.some(monster => monster.stun === 0 &&
      Math.hypot(monster.x - state.player.x, monster.y - state.player.y) < 0.58);
    if (!touched) return;
    if (--state.lives === 0) {
      state.status = 'lost';
      return;
    }
    state.boost = 0;
    state.attack = 0;
    state.invulnerable = 2;
    resetPositions();
  }

  return {
    state, turn, activate,
    start() { if (state.status === 'ready') state.status = 'playing'; },
    pause() { if (state.status === 'playing') state.status = 'paused'; },
    resume() { if (state.status === 'paused') state.status = 'playing'; },
    update(seconds) {
      if (!Number.isFinite(seconds)) return;
      // Small steps keep collision checks reliable even on slower mobile displays.
      while (state.status === 'playing' && seconds > 1e-8) {
        const slice = Math.min(seconds, 1 / 60);
        step(slice);
        seconds -= slice;
      }
    },
  };
}
