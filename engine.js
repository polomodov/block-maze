import { LEVELS } from './levels.js?v=end-family-1';
import { advanceEffects, monsterSpeed, resetSkill } from './monster-rules.js?v=end-family-1';
import { createDragon, flyDragon } from './dragon-rules.js?v=end-family-1';

// Positions use tile centers as integer coordinates. All clocks use active game seconds.
const STEPS = {
  left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1],
};
const REVERSE = { left: 'right', right: 'left', up: 'down', down: 'up' };

function actor([x, y]) {
  return { x, y, dir: null, target: null };
}

function reverse(actor) {
  const [dx, dy] = STEPS[actor.dir];
  actor.target = [actor.target[0] - dx, actor.target[1] - dy];
  actor.dir = REVERSE[actor.dir];
}

function countdown(value, seconds) {
  return value <= seconds + 1e-8 ? 0 : value - seconds;
}

export function createGame(hero = 'kirill', levelId = 'temple') {
  const state = {
    hero: ['kirill', 'maxim', 'mom', 'dad', 'pasha'].includes(hero) ? hero : 'kirill',
    status: 'ready', lives: 3, time: 0, cooldown: 0,
  };
  let level;
  let queued;
  let waiting;
  const fields = new Map();
  const tileKey = (x, y) => y * state.width + x;
  const isFloor = (x, y) => state.map[y]?.[x] === '.';

  function exits(x, y) {
    return Object.keys(STEPS).filter(dir => {
      const [dx, dy] = STEPS[dir];
      return isFloor(x + dx, y + dy);
    });
  }

  // Reuse the shortest corridor distance from each target to every other tile.
  function distancesFrom(x, y) {
    const key = tileKey(x, y);
    if (fields.has(key)) return fields.get(key);
    const distances = new Int16Array(state.width * state.height).fill(-1);
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

  function distance(x, y, tx, ty) {
    return distancesFrom(x, y)[tileKey(tx, ty)];
  }

  function resetPositions() {
    state.player = actor(level.start);
    state.lastPickup = null;
    state.monsters = level.monsters.map(beast => ({
      ...actor(beast.start), type: beast.type, stun: 0,
    }));
    state.monsters.forEach(resetSkill);
    state.dragon = level.dragon ? createDragon() : null;
    state.effects = [];
    state.levitation = 0;
    state.slow = 0;
    state.rideRemaining = 0;
    state.vault = null;
    state.boost = 0;
    state.attack = 0;
    state.fear = 0;
    state.invisible = 0;
    queued = null;
    waiting = true;
  }

  function loadLevel(id) {
    level = LEVELS[id];
    state.levelId = id;
    state.map = level.map;
    state.width = level.map[0].length;
    state.height = level.map.length;
    state.decorations = level.decorations;
    state.bridges = level.bridges ?? [];
    state.ride = level.ride ?? null;
    fields.clear();
    state.gems = new Set();
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        if (isFloor(x, y) && (x + y) % 2 === 1) state.gems.add(tileKey(x, y));
      }
    }
    state.totalGems = state.gems.size;
    state.collected = 0;
    state.invulnerable = 0;
    resetPositions();
  }
  loadLevel(Object.hasOwn(LEVELS, levelId) ? levelId : 'temple');

  function turn(dir) {
    if (state.status !== 'playing' || !Object.hasOwn(STEPS, dir)) return;
    const player = state.player;
    // A reversal can happen between tiles. Perpendicular turns wait for a junction.
    if (player.target && REVERSE[player.dir] === dir) {
      reverse(player);
      queued = null;
      return;
    }
    queued = dir;
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

  function steerPlayer(player, options) {
    const ride = state.ride;
    if (ride && queued === ride.direction && player.x === ride.entry[0] && player.y === ride.entry[1]) {
      state.rideRemaining = ride.duration;
      queued = null;
      waiting = false;
      return null;
    }
    if (options.includes(queued)) {
      const dir = queued;
      queued = null;
      waiting = false;
      return dir;
    }
    return options.includes(player.dir) ? player.dir : null;
  }

  function steerMonster(monster, options, index) {
    // Frightened monsters can turn back at any junction to get farther away.
    if (state.fear === 0 && options.length > 1) {
      options = options.filter(dir => dir !== REVERSE[monster.dir]);
    }
    const beast = level.monsters[index];
    let x = Math.round(state.player.x);
    let y = Math.round(state.player.y);
    // Patrol breaks open escape routes. The spider occasionally aims one tile ahead.
    const guarding = beast.type === 'guardian' && distance(x, y, ...beast.patrol) > 5;
    const patrolTime = beast.type !== 'zombie' && beast.type !== 'guardian' && (state.time + index * 3) % 19 > 13;
    if (state.invisible > 0 || (state.fear === 0 && (guarding || patrolTime))) {
      [x, y] = beast.patrol;
    } else if (state.fear === 0 && beast.type === 'spider' && state.player.dir) {
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
    if (state.fear > 0) {
      return options.reduce((best, dir) => cost(dir) > cost(best) ? dir : best);
    }
    return options.reduce((best, dir) => cost(dir) < cost(best) ? dir : best);
  }

  function collect(x, y) {
    if (!state.gems.delete(tileKey(x, y))) return;
    state.collected++;
    state.lastPickup = { x, y, time: state.time };
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

  function beginVault() {
    const player = state.player;
    const dir = player.target ? player.dir : queued || player.dir;
    if (!dir) return false;
    const [dx, dy] = STEPS[dir];
    const x = Math.round(player.x) + dx, y = Math.round(player.y) + dy;
    const toX = x + dx, toY = y + dy;
    const occupied = (col, row) => state.monsters.some(monster =>
      Math.round(monster.x) === col && Math.round(monster.y) === row);
    if (!isFloor(x, y) || !isFloor(toX, toY) || !occupied(x, y) || occupied(toX, toY)) return false;
    state.vault = { fromX: player.x, fromY: player.y, toX, toY, progress: 0 };
    player.target = null;
    player.dir = dir;
    queued = null;
    waiting = false;
    return true;
  }

  function advanceVault(seconds) {
    const vault = state.vault;
    vault.progress = Math.min(1, vault.progress + seconds / 0.35);
    state.player.x = vault.fromX + (vault.toX - vault.fromX) * vault.progress;
    state.player.y = vault.fromY + (vault.toY - vault.fromY) * vault.progress;
    if (vault.progress === 1) {
      state.vault = null;
      collect(vault.toX, vault.toY);
    }
  }

  function activate() {
    if (state.status !== 'playing' || state.cooldown > 0 || state.rideRemaining > 0) return false;
    if (state.hero === 'pasha' && !beginVault()) return false;
    state.cooldown = 30;
    switch (state.hero) {
      case 'kirill':
        state.boost = 4;
        break;
      case 'maxim':
        state.attack = 0.32;
        hitNearby();
        break;
      case 'mom':
        state.levitation = 0;
        state.slow = 0;
        state.invisible = 4;
        break;
      case 'dad': {
        state.levitation = 0;
        state.slow = 0;
        state.fear = 3;
        waiting = false;
        const distances = distancesFrom(Math.round(state.player.x), Math.round(state.player.y));
        for (const monster of state.monsters) {
          if (!monster.target) continue;
          const [x, y] = monster.target;
          const [dx, dy] = STEPS[monster.dir];
          if (distances[tileKey(x, y)] < distances[tileKey(x - dx, y - dy)]) {
            reverse(monster);
          }
        }
        break;
      }
    }
    return true;
  }

  function step(seconds) {
    state.time += seconds;
    const speed = (state.boost > 0 ? 6.2 : 3.8) * (state.slow > 0 ? 0.65 : 1);
    state.slow = countdown(state.slow, seconds);
    state.levitation = countdown(state.levitation, seconds);
    state.cooldown = countdown(state.cooldown, seconds);
    state.boost = countdown(state.boost, seconds);
    state.invulnerable = countdown(state.invulnerable, seconds);
    if (state.vault) advanceVault(seconds);
    else if (state.rideRemaining === 0) move(state.player, seconds * speed, steerPlayer, collect);
    if (state.rideRemaining > 0) {
      state.rideRemaining = countdown(state.rideRemaining, seconds);
      if (state.rideRemaining === 0) {
        [state.player.x, state.player.y] = state.ride.exit;
        collect(state.player.x, state.player.y);
      }
    }
    if (state.status === 'won') return;
    state.monsters.forEach((monster, index) => {
      if (waiting) {
        monster.stun = countdown(monster.stun, seconds);
        return;
      }
      const definition = level.monsters[index];
      const speedFactor = monsterSpeed(state, index, definition, seconds, isFloor, distance);
      monster.stun = countdown(monster.stun, seconds);
      if (speedFactor > 0) {
        move(monster, seconds * definition.speed * speedFactor,
          (actor, options) => steerMonster(actor, options, index));
      }
    });
    if (state.attack > 0) hitNearby();
    if (state.dragon) flyDragon(state, seconds, !waiting);
    const effectHit = advanceEffects(state, seconds, isFloor);
    state.attack = countdown(state.attack, seconds);
    state.invisible = countdown(state.invisible, seconds);
    state.fear = countdown(state.fear, seconds);
    if (waiting || state.rideRemaining > 0 || state.invulnerable > 0 || state.invisible > 0 || state.fear > 0) return;
    const touched = !state.vault && state.monsters.some(monster => monster.type !== 'shulker' && monster.type !== 'creeper' && !monster.leap && monster.stun === 0 &&
      Math.hypot(monster.x - state.player.x, monster.y - state.player.y) < 0.58);
    if (!touched && !effectHit) return;
    if (--state.lives === 0) {
      state.status = 'lost';
      return;
    }
    state.invulnerable = 2;
    resetPositions();
  }

  return {
    state, turn, activate,
    nextLevel() {
      if (state.status !== 'won' || !level.next) return false;
      loadLevel(level.next);
      state.status = 'playing';
      return true;
    },
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
