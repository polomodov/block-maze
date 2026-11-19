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

function portal(ctx, x, y, time) {
  corners(ctx, x, y, 7, '#c28fee');
  const drift = Math.floor(time * 8) % 4;
  spark(ctx, x - 5, y + 2 - drift, 1, '#dda6e7');
  spark(ctx, x + 4, y - 1 + drift, 2, '#9b79d0');
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

function aimLine(ctx, monster) {
  const sx = Math.round(monster.x), sy = Math.round(monster.y);
  const target = monster.aim;
  const dx = Math.sign(target.x - sx), dy = Math.sign(target.y - sy);
  const distance = Math.abs(target.x - sx) + Math.abs(target.y - sy);
  for (let i = 1; i < distance; i++) {
    const cx = center(sx + dx * i), cy = center(sy + dy * i);
    rect(ctx, '#ffcf83', cx - 1, cy - 1, 3, 2);
  }
  corners(ctx, center(target.x), center(target.y), 6, '#ffe3a0');
}

function drawArrow(ctx, effect) {
  const { x, y, dir } = effect;
  ctx.save();
  ctx.translate(center(x), center(y));
  ctx.rotate(({ right: 0, up: -.5, down: .5, left: 1 })[dir] * Math.PI);
  rect(ctx, '#6f4845', -5, 0, 10, 2);
  rect(ctx, '#ffd380', -5, -1, 9, 2);
  rect(ctx, '#fff3cc', 2, -2, 2, 5);
  rect(ctx, '#fff3cc', 4, -1, 2, 3);
  rect(ctx, '#fff3cc', -6, -2, 2, 2);
  rect(ctx, '#fff3cc', -6, 1, 2, 2);
  ctx.restore();
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
    if (!(monster.windup > 0) || !monster.aim) continue;
    const { x, y } = monster.aim;
    if (monster.type === 'skeleton') aimLine(ctx, monster);
    if (monster.type === 'enderman') portal(ctx, center(x), center(y), state.time);
    if (monster.type === 'creeper') markerArea(ctx, monster.cells, '#ffad71', false);
    if (monster.type === 'elder_guardian') markerArea(ctx, monster.cells, '#a2d9e6', false);
  }
  for (const effect of state.effects || []) {
    if (effect.type === 'arrow') drawArrow(ctx, effect);
    if (effect.type === 'slow_pool') puddle(ctx, effect, state.time);
    if (effect.type === 'blast') markerArea(ctx, effect.cells, '#ffdd7c', true);
    if (effect.type === 'pulse') markerArea(ctx, effect.cells, '#b5f3e7', true);
  }
}

export function showCharge(ctx, monster, x, y) {
  if (monster.charging) {
    const [dx, dy] = {up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0]}[monster.dir] || [0, 1];
    for (let i = 0; i < 2; i++) {
      rect(ctx, i ? '#87c9c2' : '#b4eee1', x + dx * (8 + i * 3) + dy * 2,
        y + dy * (8 + i * 3) + dx * 2, 2, 2);
    }
  }
  if (monster.windup > 0) {
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
