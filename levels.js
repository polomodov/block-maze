const templeMap = Object.freeze([
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

const arcadeMap = Object.freeze([
  '#######################',
  '#.............#.......#',
  '#.#####.#.###.#.......#',
  '#.#####.#.###.#.#####.#',
  '#.#####.#...#.#.#####.#',
  '#.......#.#.#...#####.#',
  '#.#####...#...........#',
  '#...#........#.####.#.#',
  '#.#.#.#.####.#......#.#',
  '#.#...#.####.#.###..#.#',
  '#.#.#.#.####.#.###..#.#',
  '#...#.................#',
  '#...#.########.######.#',
  '#.....................#',
  '#######################',
]);

export const LEVELS = {
  temple: {
    title: 'Храм изумруда',
    map: templeMap,
    start: [11, 11],
    monsters: [
      { type: 'creeper', start: [1, 1], patrol: [1, 13], speed: 2.30 },
      { type: 'zombie', start: [21, 1], patrol: [21, 13], speed: 2.05 },
      { type: 'spider', start: [11, 5], patrol: [11, 1], speed: 2.60 },
    ],
    decorations: [],
  },
  arcade: {
    title: 'Игровой центр',
    map: arcadeMap,
    start: [11, 13],
    monsters: [
      { type: 'slime', start: [1, 1], patrol: [1, 13], speed: 1.95 },
      { type: 'skeleton', start: [21, 1], patrol: [21, 13], speed: 2.25 },
      { type: 'creeper', start: [12, 7], patrol: [1, 5], speed: 2.30 },
      { type: 'spider', start: [3, 9], patrol: [21, 6], speed: 2.60 },
    ],
    // Rectangles are solid wall islands. Walkways and emeralds stay visible around them.
    decorations: [
      { type: 'carousel', x: 2, y: 2, width: 5, height: 3 },
      { type: 'slide', x: 16, y: 3, width: 5, height: 3 },
      { type: 'claw', x: 8, y: 8, width: 4, height: 3 },
    ],
  },
};
