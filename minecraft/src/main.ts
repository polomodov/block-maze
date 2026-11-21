import {
  world,
  system,
  BlockVolume,
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  GameMode,
  Player,
  Dimension,
  Entity,
  Vector3,
} from '@minecraft/server';
import { ActionFormData, FormCancelationReason } from '@minecraft/server-ui';
import { planMaze, formatTicks, MazePlan, MazeSize, SIZES, Cell } from './maze.ts';

// Blocks. Walls are three high so nobody jumps over; an invisible barrier roof keeps the sky open.
const FLOOR = 'minecraft:polished_andesite';
const WALL = 'minecraft:mossy_stone_bricks';
const WALL_TOP = 'minecraft:chiseled_stone_bricks';
const LAMP = 'minecraft:sea_lantern'; // on every corner pillar, so the maze stays lit at night
const EMERALD = 'minecraft:emerald_block';
const FINISH = 'minecraft:gold_block';
const ROOF = 'minecraft:barrier';
const MONSTER = 'minecraft:husk'; // husks do not burn in daylight
const MOB_TAG = 'emerald_maze_mob';
const LIVES = 3;

// Saved on the player so a game survives a disconnect or a world reload.
const SAVE_KEY = 'emerald_maze:return';
const RECORD_KEY = (size: MazeSize) => 'emerald_maze:record:' + size;

type Game = {
  id: string;
  player: Player;
  dimension: Dimension;
  size: MazeSize;
  plan: MazePlan;
  origin: Vector3; // world position of grid block (0, 0); floor is at origin.y
  emeraldsLeft: Set<string>;
  lives: number;
  startTick: number;
  mobs: { entity: Entity; home: Cell }[];
  allCollectedShown: boolean;
};

type ReturnInfo = { dim: string; x: number; y: number; z: number; mode: GameMode; area: number[] };

const games = new Map<string, Game>();
const key = (c: Cell) => c.x + ',' + c.z;

function at(game: Game, c: Cell, dy = 1): Vector3 {
  return { x: game.origin.x + c.x + 0.5, y: game.origin.y + dy, z: game.origin.z + c.z + 0.5 };
}

// ---------- building ----------

function areaFor(player: Player, plan: MazePlan): Vector3 {
  const range = player.dimension.heightRange;
  return {
    x: Math.floor(player.location.x) - Math.floor(plan.size / 2),
    y: range.max - 40,
    z: Math.floor(player.location.z) - Math.floor(plan.size / 2),
  };
}

function clearArea(dimension: Dimension, area: number[]) {
  const [x, y, z, size] = area;
  dimension.fillBlocks(new BlockVolume({ x, y, z }, { x: x + size - 1, y: y + 4, z: z + size - 1 }), 'minecraft:air', {
    ignoreChunkBoundErrors: true,
  });
}

function build(dimension: Dimension, plan: MazePlan, o: Vector3) {
  const n = plan.size - 1;
  dimension.fillBlocks(new BlockVolume(o, { x: o.x + n, y: o.y, z: o.z + n }), FLOOR);
  dimension.fillBlocks(new BlockVolume({ x: o.x, y: o.y + 1, z: o.z }, { x: o.x + n, y: o.y + 3, z: o.z + n }), 'minecraft:air');
  dimension.fillBlocks(new BlockVolume({ x: o.x, y: o.y + 4, z: o.z }, { x: o.x + n, y: o.y + 4, z: o.z + n }), ROOF);
  for (let z = 0; z <= n; z++) {
    for (let x = 0; x <= n; x++) {
      if (!plan.wall[z][x]) continue;
      dimension.fillBlocks(new BlockVolume({ x: o.x + x, y: o.y + 1, z: o.z + z }, { x: o.x + x, y: o.y + 2, z: o.z + z }), WALL);
      dimension.setBlockType({ x: o.x + x, y: o.y + 3, z: o.z + z }, x % 2 === 0 && z % 2 === 0 ? LAMP : WALL_TOP);
    }
  }
  for (const c of plan.emeralds) dimension.setBlockType({ x: o.x + c.x, y: o.y, z: o.z + c.z }, EMERALD);
  dimension.setBlockType({ x: o.x + plan.finish.x, y: o.y, z: o.z + plan.finish.z }, FINISH);
}

// ---------- game lifecycle ----------

function startGame(player: Player, size: MazeSize) {
  if (games.has(player.id)) endGame(games.get(player.id)!, 'stop');
  const plan = planMaze(size, (Date.now() ^ system.currentTick) >>> 0);
  const dimension = player.dimension;
  const origin = areaFor(player, plan);
  try {
    build(dimension, plan, origin);
  } catch (e) {
    player.sendMessage('§cНе получилось построить лабиринт здесь: ' + String(e));
    return;
  }

  const info: ReturnInfo = {
    dim: dimension.id,
    x: player.location.x,
    y: player.location.y,
    z: player.location.z,
    mode: player.getGameMode(),
    area: [origin.x, origin.y, origin.z, plan.size],
  };
  player.setDynamicProperty(SAVE_KEY, JSON.stringify(info));

  const game: Game = {
    id: player.id,
    player,
    dimension,
    size,
    plan,
    origin,
    emeraldsLeft: new Set(plan.emeralds.map(key)),
    lives: LIVES,
    startTick: system.currentTick,
    mobs: [],
    allCollectedShown: false,
  };
  games.set(player.id, game);

  player.setGameMode(GameMode.Adventure);
  player.teleport(at(game, plan.start), { dimension });
  protect(player);
  for (const home of plan.monsters) {
    const entity = dimension.spawnEntity(MONSTER, at(game, home));
    entity.addTag(MOB_TAG);
    game.mobs.push({ entity, home });
  }
  player.onScreenDisplay.setTitle('§aИзумрудный лабиринт', {
    subtitle: 'Собери ' + plan.emeralds.length + ' изумрудов и встань на золото',
    fadeInDuration: 10,
    stayDuration: 60,
    fadeOutDuration: 20,
  });
  player.playSound('random.levelup');
}

function protect(player: Player) {
  // The maze is a family game: monsters "catch" instead of hurting, so nothing is ever lost.
  player.addEffect('resistance', 20 * 60 * 30, { amplifier: 255, showParticles: false });
  player.addEffect('saturation', 20 * 60 * 30, { amplifier: 1, showParticles: false });
}

function restorePlayer(player: Player) {
  const raw = player.getDynamicProperty(SAVE_KEY);
  if (typeof raw !== 'string') return;
  player.setDynamicProperty(SAVE_KEY, undefined);
  const info = JSON.parse(raw) as ReturnInfo;
  const dimension = world.getDimension(info.dim);
  try {
    clearArea(dimension, info.area);
  } catch {
    // Chunks may be unloaded after a reload; the maze then just stays in the sky.
  }
  for (const mob of dimension.getEntities({ tags: [MOB_TAG] })) mob.remove();
  player.removeEffect('resistance');
  player.removeEffect('saturation');
  player.setGameMode(info.mode);
  player.teleport({ x: info.x, y: info.y, z: info.z }, { dimension });
}

function endGame(game: Game, reason: 'win' | 'lose' | 'stop' | 'left') {
  games.delete(game.id);
  for (const mob of game.mobs) if (mob.entity.isValid) mob.entity.remove();
  if (reason === 'left') {
    // The player is gone; clear the maze now and restore them on their next join.
    try {
      clearArea(game.dimension, [game.origin.x, game.origin.y, game.origin.z, game.plan.size]);
    } catch {}
    return;
  }
  const player = game.player;
  const ticks = system.currentTick - game.startTick;
  if (reason === 'win') {
    const best = world.getDynamicProperty(RECORD_KEY(game.size));
    const record = typeof best !== 'number' || ticks < best;
    if (record) world.setDynamicProperty(RECORD_KEY(game.size), ticks);
    player.onScreenDisplay.setTitle('§6Победа!', {
      subtitle: 'Время ' + formatTicks(ticks) + (record ? ' — новый рекорд!' : ' · рекорд ' + formatTicks(best as number)),
      fadeInDuration: 5,
      stayDuration: 80,
      fadeOutDuration: 20,
    });
    player.playSound('random.totem');
  } else if (reason === 'lose') {
    player.onScreenDisplay.setTitle('§cПоймали!', {
      subtitle: 'Жизни закончились. Попробуй ещё: /maze:start',
      fadeInDuration: 5,
      stayDuration: 60,
      fadeOutDuration: 20,
    });
    player.playSound('mob.husk.ambient');
  }
  // Leave a moment to read the title before flying home.
  system.runTimeout(() => {
    if (player.isValid) restorePlayer(player);
  }, reason === 'stop' ? 1 : 40);
}

// ---------- every few ticks ----------

function update(game: Game) {
  const { player, plan, origin } = game;
  if (!player.isValid) return endGame(game, 'left');
  const p = player.location;
  const cell = { x: Math.floor(p.x) - origin.x, z: Math.floor(p.z) - origin.z };
  const inside = cell.x >= 0 && cell.z >= 0 && cell.x < plan.size && cell.z < plan.size;
  if (player.dimension.id !== game.dimension.id || !inside || p.y < origin.y - 2 || p.y > origin.y + 6) {
    // Teleported out by a command or another add-on: the game is over.
    return endGame(game, 'stop');
  }

  const k = key(cell);
  if (game.emeraldsLeft.delete(k)) {
    game.dimension.setBlockType({ x: origin.x + cell.x, y: origin.y, z: origin.z + cell.z }, FLOOR);
    player.playSound('random.orb', { pitch: 1 + (plan.emeralds.length - game.emeraldsLeft.size) / plan.emeralds.length });
  }
  const done = game.emeraldsLeft.size === 0;
  if (done && !game.allCollectedShown) {
    game.allCollectedShown = true;
    player.onScreenDisplay.setTitle(' ', { subtitle: '§6Все изумруды! Беги к золотому блоку', fadeInDuration: 0, stayDuration: 50, fadeOutDuration: 10 });
    player.playSound('note.pling');
  }
  if (cell.x === plan.finish.x && cell.z === plan.finish.z) {
    if (done) return endGame(game, 'win');
  }

  for (const mob of game.mobs) {
    if (!mob.entity.isValid) continue;
    const m = mob.entity.location;
    if (Math.abs(m.x - p.x) < 1.1 && Math.abs(m.z - p.z) < 1.1 && Math.abs(m.y - p.y) < 2) {
      game.lives--;
      if (game.lives <= 0) return endGame(game, 'lose');
      player.teleport(at(game, plan.start));
      for (const other of game.mobs) if (other.entity.isValid) other.entity.teleport(at(game, other.home));
      player.playSound('mob.husk.hurt');
      player.onScreenDisplay.setTitle(' ', { subtitle: '§cПоймали! Осталось жизней: ' + game.lives, fadeInDuration: 0, stayDuration: 40, fadeOutDuration: 10 });
      break;
    }
  }

  const ticks = system.currentTick - game.startTick;
  const collected = plan.emeralds.length - game.emeraldsLeft.size;
  player.onScreenDisplay.setActionBar(
    '§aИзумруды ' + collected + '/' + plan.emeralds.length + '  §f' + formatTicks(ticks) + (game.mobs.length ? '  §c' + '❤'.repeat(game.lives) : ''),
  );
}

system.runInterval(() => {
  for (const game of [...games.values()]) update(game);
}, 2);

// ---------- menu and commands ----------

function showMenu(player: Player, attempt = 0) {
  const sizes = Object.keys(SIZES) as MazeSize[];
  const form = new ActionFormData()
    .title('Изумрудный лабиринт')
    .body('Собери все изумрудные плитки и встань на золотой блок.\nВ больших лабиринтах бродят кадавры: если поймают, вернёшься на старт.');
  for (const size of sizes) {
    const r = SIZES[size];
    const best = world.getDynamicProperty(RECORD_KEY(size));
    form.button(
      r.label + ' · ' + r.emeralds + ' изумр.' + (r.monsters ? ' · ' + r.monsters + ' монстра' : '') +
        (typeof best === 'number' ? '\nРекорд ' + formatTicks(best) : ''),
    );
  }
  form.show(player).then(res => {
    if (res.canceled) {
      // The chat window is still closing when a command opens the menu; try again shortly.
      if (res.cancelationReason === FormCancelationReason.UserBusy && attempt < 20) system.runTimeout(() => showMenu(player, attempt + 1), 10);
      return;
    }
    if (res.selection !== undefined) startGame(player, sizes[res.selection]);
  });
}

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
  customCommandRegistry.registerEnum('maze:size', Object.keys(SIZES));
  customCommandRegistry.registerCommand(
    {
      name: 'maze:start',
      description: 'Изумрудный лабиринт: построить лабиринт и начать игру',
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      optionalParameters: [{ name: 'maze:size', type: CustomCommandParamType.Enum }],
    },
    (origin, size?: MazeSize) => {
      const player = origin.sourceEntity;
      if (!(player instanceof Player)) return { status: CustomCommandStatus.Failure, message: 'Команду должен ввести игрок' };
      // Commands run in a read-only context; world changes happen on the next tick.
      system.run(() => (size ? startGame(player, size) : showMenu(player)));
      return { status: CustomCommandStatus.Success };
    },
  );
  customCommandRegistry.registerCommand(
    {
      name: 'maze:stop',
      description: 'Изумрудный лабиринт: выйти из игры и вернуться обратно',
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    origin => {
      const player = origin.sourceEntity;
      if (!(player instanceof Player)) return { status: CustomCommandStatus.Failure };
      system.run(() => {
        const game = games.get(player.id);
        if (game) endGame(game, 'stop');
        else restorePlayer(player);
      });
      return { status: CustomCommandStatus.Success };
    },
  );
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  // Came back after leaving mid-game (or after a world reload): fly home first.
  system.runTimeout(() => {
    if (!player.isValid) return;
    restorePlayer(player);
    player.sendMessage('§aИзумрудный лабиринт§r: напиши §e/maze:start§r, чтобы сыграть.');
  }, 40);
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  const game = games.get(playerId);
  if (game) endGame(game, 'left');
});
