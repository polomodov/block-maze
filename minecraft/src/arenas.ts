import { BlockVolume, BlockVolumeIntersection, world, type Dimension, type Vector3 } from '@minecraft/server';

const ARENA_PREFIX = 'emerald_maze:arena:';
const SERIAL_KEY = 'emerald_maze:session_number';

type Arena = { dimensionId: string; origin: Vector3; size: number; mobTag: string };

function volume(origin: Vector3, size: number) {
  return new BlockVolume(origin, { x: origin.x + size - 1, y: origin.y + 4, z: origin.z + size - 1 });
}

function readArena(key: string): Arena | undefined {
  const raw = world.getDynamicProperty(key);
  if (typeof raw === 'string') return JSON.parse(raw) as Arena;
}

// The reservation survives script reloads and stays in place until cleanup succeeds.
export function reserveArena(owner: string, dimension: Dimension, origin: Vector3, size: number): string {
  const bounds = volume(origin, size);
  for (const key of world.getDynamicPropertyIds()) {
    if (!key.startsWith(ARENA_PREFIX)) continue;
    const arena = readArena(key);
    if (arena?.dimensionId === dimension.id &&
        bounds.intersects(volume(arena.origin, arena.size)) !== BlockVolumeIntersection.Disjoint) {
      throw new Error('Здесь уже есть лабиринт. Отойди подальше и попробуй снова.');
    }
  }
  // Unloaded chunks must fail the check before the first write.
  if (dimension.containsBlock(bounds, { excludeTypes: ['minecraft:air'] }, false)) {
    throw new Error('Место для лабиринта занято блоками. Попробуй в другом месте.');
  }
  const serial = Number(world.getDynamicProperty(SERIAL_KEY) ?? 0) + 1;
  world.setDynamicProperty(SERIAL_KEY, serial);
  const mobTag = 'emerald_maze_session_' + serial;
  const arena: Arena = { dimensionId: dimension.id, origin, size, mobTag };
  world.setDynamicProperty(ARENA_PREFIX + owner, JSON.stringify(arena));
  return mobTag;
}

export function releaseArena(owner: string) {
  const key = ARENA_PREFIX + owner;
  const arena = readArena(key);
  if (!arena) return;
  const dimension = world.getDimension(arena.dimensionId);
  for (const mob of dimension.getEntities({ tags: [arena.mobTag] })) mob.remove();
  dimension.fillBlocks(volume(arena.origin, arena.size), 'minecraft:air', { ignoreChunkBoundErrors: false });
  world.setDynamicProperty(key, undefined);
}
