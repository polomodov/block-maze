// The dragon crosses the maze above the walls. Only clouds on marked floor cells can hit.
export function createDragon() {
  return { x: 2, y: 3.5, dir: 'right', phase: 'patrol', windup: 0, cells: [] };
}

function startPass(state, dragon, canBreathe) {
  dragon.dir = dragon.dir === 'right' ? 'left' : 'right';
  dragon.x = dragon.dir === 'right' ? -2 : state.width + 1;
  if (!canBreathe) {
    dragon.phase = 'patrol';
    dragon.y = 1 + (Math.round(dragon.y) + 4) % (state.height - 2);
    return;
  }

  // Lock the targets before re-entering the screen. The marked trail never follows the hero.
  const x = Math.round(state.player.x);
  dragon.y = Math.round(state.player.y);
  const floor = [...state.map[dragon.y]].flatMap((tile, col) => tile === '.' ? [col] : []);
  floor.sort((a, b) => Math.abs(a - x) - Math.abs(b - x));
  dragon.cells = [];
  for (const col of floor) {
    if (dragon.cells.every(([other]) => Math.abs(col - other) >= 2)) dragon.cells.push([col, dragon.y]);
    if (dragon.cells.length === 3) break;
  }
  dragon.phase = 'warning';
  dragon.windup = 1.2;
}

export function flyDragon(state, seconds, playerHasMoved) {
  const dragon = state.dragon;
  const canBreathe = playerHasMoved && state.invisible === 0 && state.fear === 0;
  if (!canBreathe) {
    dragon.cells = [];
    dragon.phase = 'patrol';
    dragon.windup = 0;
  }
  if (dragon.phase === 'warning') {
    dragon.windup = Math.max(0, dragon.windup - seconds);
    if (dragon.windup === 0) dragon.phase = 'breathing';
    return;
  }

  const rightward = dragon.dir === 'right';
  dragon.x += (rightward ? 1 : -1) * 4.6 * seconds;
  if (dragon.phase === 'breathing') {
    dragon.cells = dragon.cells.filter(([x, y]) => {
      if (rightward ? dragon.x < x : dragon.x > x) return true;
      state.effects.push({ type: 'dragon_breath', x, y, remaining: 3 });
      return false;
    });
    if (!dragon.cells.length) dragon.phase = 'patrol';
  }
  if (dragon.x < -2 || dragon.x > state.width + 1) startPass(state, dragon, canBreathe);
}
