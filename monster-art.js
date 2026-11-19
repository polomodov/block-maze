import { drawArrowFlight, drawBlast, drawTeleport } from './monster-motion.js?v=monster-motion-1';
// Signals use different silhouettes as well as colors. Keep all marks inside the walkways.
const unit = 20;
const center = tile => Math.round((tile + .5) * unit);

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function corners(ctx, x, y, radius, color) {
  for (const dx of [-1, 1]) {
    for (const dy of [-1, 1]) {
      const left = x + dx * radius, top = y + dy * radius;
      rect(ctx, color, left - (dx > 0 ? 3 : 0), top, 4, 1);
      rect(ctx, color, left, top - (dy > 0 ? 3 : 0), 1, 4);
    }
  }
}

function spark(ctx, x, y, size, color) {
  rect(ctx, color, x - size, y, 2 * size + 1, 1);
  rect(ctx, color, x, y - size, 1, 2 * size + 1);
}

function markerArea(ctx, tiles, color, active) {
  for (const [x, y] of tiles) {
    const cx = center(x), cy = center(y);
    corners(ctx, cx, cy, 8, color);
    if (active) {
      spark(ctx, cx - 4, cy - 2, 2, color);
      spark(ctx, cx + 4, cy + 3, 1, color);
    }
  }
}

function aimLine(ctx, monster, color) {
  const sx = Math.round(monster.x), sy = Math.round(monster.y);
  const target = monster.aim;
  const dx = Math.sign(target.x - sx), dy = Math.sign(target.y - sy);
  const distance = Math.abs(target.x - sx) + Math.abs(target.y - sy);
  for (let i = 1; i < distance; i++) {
    const cx = center(sx + dx * i), cy = center(sy + dy * i);
    rect(ctx, '#4e323a', cx - 2, cy - 2, 5, 4);
    rect(ctx, color, cx - 1, cy - 1, 3, 2);
  }
  corners(ctx, center(target.x), center(target.y), 6, color);
}

function fireball(ctx, x, y, dir, time) {
  const tail = 1 + Math.floor(time * 8) % 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(({right: 0, up: -.5, down: .5, left: 1})[dir] * Math.PI);
  rect(ctx, '#532e3b', -3, -4, 6, 9);
  rect(ctx, '#532e3b', -5, -2, 10, 5);
  rect(ctx, '#cf5137', -7 - tail, -2, 8 + tail, 3);
  rect(ctx, '#eb6735', -5 - tail, 1, 6 + tail, 2);
  rect(ctx, '#ffa23d', -4, -2, 8, 5);
  rect(ctx, '#ffb34d', -2, -3, 4, 7);
  rect(ctx, '#fff6b9', -1, -2, 3, 4);
  rect(ctx, '#ffe186', 2, -1, 2, 2);
  ctx.restore();
}

function landing(ctx, x, y, time) {
  const cx = center(x), cy = center(y);
  const outer = 6 + Math.floor(time * 4) % 2;
  corners(ctx, cx, cy, outer + 1, '#632e37');
  corners(ctx, cx, cy, outer, '#ffc18b');
  rect(ctx, '#ffe6a3', cx - 4, cy + 3, 9, 1);
  rect(ctx, '#ffe6a3', cx - 2, cy + 1, 5, 1);
}

function puddle(ctx, effect, time) {
  const x = center(effect.x), y = center(effect.y);
  rect(ctx, '#614367', x - 7, y - 3, 14, 6);
  rect(ctx, '#a866ac', x - 6, y - 4, 10, 6);
  rect(ctx, '#ba77bd', x - 4, y + 2, 8, 2);
  const dy = Math.floor(time * 4) % 3;
  rect(ctx, '#eeb3d9', x - 3, y - 2 - dy, 2, 2);
  rect(ctx, '#c48cbd', x + 3, y - 3 + dy, 2, 1);
}

// Pass the same affected cells as the simulation to keep warnings in step with collision rules.
export function drawMonsterEffects(ctx, state) {
  for (const monster of state.monsters) {
    if (monster.type === 'enderman') drawTeleport(ctx, monster, state.time, unit);
    if (monster.leap) landing(ctx, ...monster.leap.to, state.time);
    if (!(monster.windup > 0) || !monster.aim) continue;
    const { x, y } = monster.aim;
    if (monster.type === 'skeleton') aimLine(ctx, monster, '#ffe3a0');
    if (monster.type === 'ghast') aimLine(ctx, monster, '#ffb092');
    if (monster.type === 'magma_cube') landing(ctx, x, y, state.time);
    if (monster.type === 'pumpkin_guard') markerArea(ctx, monster.cells, '#fca55b', false);
    if (monster.type === 'creeper') markerArea(ctx, monster.cells, '#ffad71', false);
    if (monster.type === 'elder_guardian') markerArea(ctx, monster.cells, '#a2d9e6', false);
  }
  for (const effect of state.effects || []) {
    if (effect.type === 'arrow') drawArrowFlight(ctx, effect, unit);
    if (effect.type === 'fireball') fireball(ctx, center(effect.x), center(effect.y), effect.dir, state.time);
    if (effect.type === 'lantern') markerArea(ctx, effect.cells, '#ffdf76', true);
    if (effect.type === 'slow_pool') puddle(ctx, effect, state.time);
    if (effect.type === 'pulse') markerArea(ctx, effect.cells, '#b5f3e7', true);
  }
  for (const burst of state.blastBursts || []) drawBlast(ctx, burst, state.time, unit);
}

export function showCharge(ctx, monster, x, y) {
  if (monster.charging) {
    const [dx, dy] = {up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0]}[monster.dir] || [0, 1];
    for (let i = 0; i < 2; i++) {
      rect(ctx, i ? '#87c9c2' : '#b4eee1', x + dx * (8 + i * 3) + dy * 2,
        y + dy * (8 + i * 3) + dx * 2, 2, 2);
    }
  }
  if (monster.windup > 0 && monster.type === 'ghast') {
    rect(ctx, '#773945', x - 3, y, 6, 4);
    rect(ctx, '#ffa75c', x - 2, y, 4, 3);
    rect(ctx, '#ffe9a1', x - 1, y, 2, 2);
  }
  if (monster.windup > 0 && !['skeleton','enderman','creeper'].includes(monster.type)) {
    rect(ctx, '#453944', x - 2, y - 12, 5, 9);
    rect(ctx, '#ffdda0', x, y - 11, 2, 4);
    rect(ctx, '#ffdda0', x, y - 6, 2, 2);
  }
}

export function showSlow(ctx, x, y, time) {
  const drift = Math.floor(time * 4) % 3;
  rect(ctx, '#dab1e7', x - 8, y + 4 - drift, 1, 3);
  rect(ctx, '#dab1e7', x + 7, y + 6 - drift, 2, 2);
  rect(ctx, '#987eb5', x - 6, y + 7, 12, 1);
}
