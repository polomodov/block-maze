// Run the bundled command and event handlers against an in-memory Bedrock world.
import { build } from 'esbuild';
import { compileFunction } from 'node:vm';
import { fileURLToPath } from 'node:url';

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/main.ts', import.meta.url))],
  bundle: true, format: 'cjs', write: false, external: ['@minecraft/server', '@minecraft/server-ui'],
});
const loadAddon = compileFunction(bundle.outputFiles[0].text, ['require']);

class Properties {
  properties = new Map();
  getDynamicProperty(key) { return this.properties.get(key); }
  getDynamicPropertyIds() { return [...this.properties.keys()]; }
  setDynamicProperty(key, value) {
    if (value === undefined) this.properties.delete(key);
    else this.properties.set(key, value);
  }
}

class Player extends Properties {
  mode = 'creative';
  isValid = true;
  messages = [];
  onScreenDisplay = { setTitle() {}, setActionBar() {} };
  constructor(id, dimension, location) {
    super();
    Object.assign(this, { id, dimension, location });
  }
  teleport(position, { dimension = this.dimension } = {}) {
    Object.assign(this, { dimension, location: { ...position } });
  }
  sendMessage(text) { this.messages.push(text); }
  getGameMode() { return this.mode; }
  setGameMode(mode) { this.mode = mode; }
  addEffect() {}
  removeEffect() {}
  playSound() {}
}

class BlockVolume {
  constructor(from, to) { Object.assign(this, { from, to }); }
  intersects(other) {
    return Number(['x', 'y', 'z'].every(k => this.from[k] <= other.to[k] && other.from[k] <= this.to[k]));
  }
  *positions() {
    for (let x = this.from.x; x <= this.to.x; x++)
      for (let y = this.from.y; y <= this.to.y; y++)
        for (let z = this.from.z; z <= this.to.z; z++) yield { x, y, z };
  }
}

class Dimension {
  blocks = new Map();
  mobs = [];
  heightRange = { max: 320 };
  loaded = true;
  writes = 0;
  constructor(id) { this.id = id; }
  containsBlock(bounds, filter, allowUnloadedChunks) {
    if (!this.loaded && !allowUnloadedChunks) throw Error('Unloaded chunks');
    for (const { x, y, z } of bounds.positions()) {
      const block = this.blocks.get([x, y, z].join(',')) ?? 'minecraft:air';
      if (!filter.excludeTypes.includes(block)) return true;
    }
    return false;
  }
  setBlockType({ x, y, z }, type) {
    const key = [x, y, z].join(',');
    if (type === 'minecraft:air') this.blocks.delete(key);
    else this.blocks.set(key, type);
    this.writes++;
  }
  fillBlocks(bounds, type, options) {
    if (!this.loaded && !options?.ignoreChunkBoundErrors) throw Error('Unloaded chunks');
    for (const position of bounds.positions()) this.setBlockType(position, type);
  }
  spawnEntity(type, location) {
    const entity = { type, location, isValid: true, tags: [],
      addTag(tag) { this.tags.push(tag); },
      remove() { this.isValid = false; },
      teleport(position) { this.location = position; },
    };
    this.mobs.push(entity);
    return entity;
  }
  getEntities({ tags }) {
    return this.mobs.filter(mob => mob.isValid && tags.every(tag => mob.tags.includes(tag)));
  }
}

export function bedrock() {
  const world = new Properties();
  const dimensions = new Map();
  world.getDimension = id => {
    if (!dimensions.has(id)) dimensions.set(id, new Dimension(id));
    return dimensions.get(id);
  };
  const dimension = world.getDimension('overworld');
  const commands = new Map();
  const events = {};
  const delayed = [];
  const event = name => ({ subscribe(fn) { events[name] = fn; } });
  const system = { currentTick: 0, beforeEvents: { startup: event('startup') },
    run(fn) { fn(); }, runTimeout(fn) { delayed.push(fn); }, runInterval(fn) { events.tick = fn; },
  };
  world.afterEvents = { playerSpawn: event('spawn'), playerLeave: event('leave') };
  const server = { system, world, Player, BlockVolume, BlockVolumeIntersection: { Disjoint: 0 },
    GameMode: { Adventure: 'adventure' }, CommandPermissionLevel: {}, CustomCommandParamType: {}, CustomCommandStatus: {},
  };
  function reload() {
    delayed.length = 0;
    loadAddon(name => name === '@minecraft/server' ? server : {});
    events.startup({ customCommandRegistry: {
      registerEnum() {}, registerCommand({ name }, fn) { commands.set(name, fn); },
    } });
  }
  reload();
  return {
    world, dimension, events, reload,
    player(id, x = 0, dim = dimension) { return new Player(id, dim, { x, y: 64, z: 0 }); },
    start(player, size = 'medium') { commands.get('maze:start')({ sourceEntity: player }, size); },
    stop(player) { commands.get('maze:stop')({ sourceEntity: player }); },
    flushTimers() { for (const fn of delayed.splice(0)) fn(); },
  };
}
