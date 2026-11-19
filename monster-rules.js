// All durations below use active game time. Warning targets stay fixed until the attack resolves.
const PREPARATION = { creeper: 1, skeleton: 0.65, elder_guardian: 0.9, enderman: 0.9 };
const RECOVERY = { creeper: 3, skeleton: 5, elder_guardian: 8, enderman: 8 };
const ARROW_STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function resetSkill(monster) {
  monster.skillCooldown = monster.type === 'creeper' ? 0 : 2.5;
  monster.charging = false;
  clearWarning(monster);
}

function clearWarning(monster) {
  monster.windup = 0;
  monster.aim = null;
  monster.cells = null;
}

function corridorDirection(x, y, tx, ty, maxRange, floor) {
  const length = Math.abs(tx - x) + Math.abs(ty - y);
  if (length === 0 || length > maxRange || (x !== tx && y !== ty)) return null;
  const dx = Math.sign(tx - x), dy = Math.sign(ty - y);
  for (let i = 1; i <= length; i++) {
    if (!floor(x + i * dx, y + i * dy)) return null;
  }
  return dx ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

function area(x, y, radius, floor, distance) {
  const cells = [];
  for (let cy = y - radius; cy <= y + radius; cy++) {
    for (let cx = x - radius; cx <= x + radius; cx++) {
      if (floor(cx, cy) && distance(x, y, cx, cy) <= radius) cells.push([cx, cy]);
    }
  }
  return cells;
}

function safeLanding(state, monster, x, y, distance) {
  const player = state.player;
  return distance(Math.round(player.x), Math.round(player.y), x, y) >= 2 &&
    state.monsters.every(other => other === monster || Math.hypot(x - other.x, y - other.y) >= 1);
}

function teleportTarget(state, monster, floor, distance) {
  const px = Math.round(state.player.x), py = Math.round(state.player.y);
  const mx = Math.round(monster.x), my = Math.round(monster.y);
  // Prefer a landing in a different aisle. The two-tile safety margin is checked again on arrival.
  let target = null;
  let farthest = 2;
  for (let y = py - 3; y <= py + 3; y++) {
    for (let x = px - 3; x <= px + 3; x++) {
      if (!floor(x, y) || distance(px, py, x, y) > 3) continue;
      const fromMonster = distance(mx, my, x, y);
      if (fromMonster > farthest && safeLanding(state, monster, x, y, distance)) {
        target = { x, y };
        farthest = fromMonster;
      }
    }
  }
  return target;
}

function resolveWarning(state, monster, index, spawn, distance) {
  const { x, y, type, aim, cells } = monster;
  switch (type) {
    case 'creeper':
      state.effects.push({ type: 'blast', x, y, cells, owner: index, remaining: 0.32 });
      [monster.x, monster.y] = spawn;
      monster.dir = null;
      monster.target = null;
      break;
    case 'skeleton':
      state.effects.push({ type: 'arrow', x, y, dir: aim.dir, owner: index, remaining: 4 / 5 });
      break;
    case 'elder_guardian':
      state.effects.push({ type: 'pulse', x, y, cells, owner: index, remaining: 0.35 });
      break;
    case 'enderman':
      if (safeLanding(state, monster, aim.x, aim.y, distance)) {
        monster.x = aim.x;
        monster.y = aim.y;
        monster.dir = null;
      }
      break;
  }
  monster.skillCooldown = RECOVERY[type];
  clearWarning(monster);
}

function startWarning(state, monster, index, floor, distance) {
  const type = monster.type;
  const x = Math.round(monster.x), y = Math.round(monster.y);
  const px = Math.round(state.player.x), py = Math.round(state.player.y);
  const range = distance(x, y, px, py);
  let aim;
  switch (type) {
    case 'witch':
      if (range <= 7) {
        state.effects.push({ type: 'slow_pool', x, y, owner: index, remaining: 4 });
        monster.skillCooldown = 6;
      }
      return;
    case 'creeper':
    case 'elder_guardian': {
      const radius = type === 'creeper' ? 1 : 3;
      if (range > (type === 'creeper' ? 2 : radius)) return;
      aim = { x, y };
      monster.cells = area(x, y, radius, floor, distance);
      break;
    }
    case 'skeleton': {
      const dir = corridorDirection(x, y, px, py, 4, floor);
      if (!dir) return;
      aim = { x: px, y: py, dir };
      break;
    }
    case 'enderman':
      if (range < 4) return;
      aim = teleportTarget(state, monster, floor, distance);
      if (!aim) return;
      break;
    default:
      return;
  }
  monster.x = x;
  monster.y = y;
  monster.target = null;
  monster.aim = aim;
  monster.windup = PREPARATION[type];
}

// The motion multiplier lets ordinary corridor movement enforce walls for lunges and hops too.
export function monsterSpeed(state, index, definition, seconds, floor, distance) {
  const monster = state.monsters[index];
  const distracted = state.fear > 0 || state.invisible > 0 || monster.stun > 0;
  monster.skillCooldown = Math.max(0, monster.skillCooldown - seconds);
  if (distracted && monster.windup > 0) {
    clearWarning(monster);
    monster.skillCooldown = 1;
  }
  if (monster.stun > 0) return 0;
  if (monster.windup > 0) {
    monster.windup = Math.max(0, monster.windup - seconds);
    if (monster.windup < 1e-8) resolveWarning(state, monster, index, definition.start, distance);
    return 0;
  }

  const x = Math.round(monster.x), y = Math.round(monster.y);
  if (!distracted && monster.skillCooldown === 0 && Math.hypot(monster.x - x, monster.y - y) < 0.05) {
    startWarning(state, monster, index, floor, distance);
    if (monster.windup > 0) return 0;
  }
  if (monster.type === 'slime') return state.time % 0.9 < 0.55 ? 1.55 : 0;
  if (monster.type === 'drowned') {
    const dir = corridorDirection(x, y, Math.round(state.player.x), Math.round(state.player.y), 5, floor);
    monster.charging = !distracted && !!dir && (!monster.dir || monster.dir === dir);
    if (monster.charging) return 1.42;
  }
  return 1;
}

export function advanceEffects(state, seconds, floor) {
  let hit = false;
  const protectedPlayer = state.invulnerable > 0 || state.rideRemaining > 0 ||
    state.invisible > 0 || state.fear > 0;
  const px = Math.round(state.player.x), py = Math.round(state.player.y);
  state.effects = state.effects.filter(effect => {
    const owner = state.monsters[effect.owner];
    // A disarmed attack cannot resume in flight after invisibility, fear or stun expires.
    if (state.invisible > 0 || state.fear > 0 || owner.stun > 0) return false;
    const dt = Math.min(seconds, effect.remaining);
    effect.remaining -= dt;
    if (effect.type === 'arrow') {
      const [dx, dy] = ARROW_STEP[effect.dir];
      effect.x += dx * 5 * dt;
      effect.y += dy * 5 * dt;
      if (!floor(Math.round(effect.x), Math.round(effect.y))) return false;
      if (!protectedPlayer && Math.hypot(effect.x - state.player.x, effect.y - state.player.y) < 0.42) {
        hit = true;
        return false;
      }
    } else if (!protectedPlayer) {
      const inside = effect.cells ? effect.cells.some(([x, y]) => x === px && y === py) :
        effect.x === px && effect.y === py;
      if (inside) {
        if (effect.type === 'blast') hit = true;
        else state.slow = effect.type === 'pulse' ? 1.8 : Math.max(state.slow, 1);
      }
    }
    return effect.remaining > 1e-8;
  });
  return hit;
}
