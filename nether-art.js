// Volcanic rock is drawn in cool violets so the walkways stand apart from the molten river.
const basalt = '#524554';
const basaltLight = '#887283';
const basaltDark = '#332e3a';
const lava = '#ef7838';
const ember = '#ffab49';
const glow = '#ffe69b';

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// Use integer spans for sloping silhouettes; even the bridge arch stays pixel-sharp.
function polygon(ctx, color, points) {
  const heights = points.map(p => p[1]);
  for (let y = Math.min(...heights); y < Math.max(...heights); y++) {
    const cuts = [];
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % points.length];
      if ((y0 > y) !== (y1 > y)) cuts.push(x0 + (y + .5 - y0) * (x1 - x0) / (y1 - y0));
    }
    cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i += 2) {
      const x = Math.round(cuts[i]);
      rect(ctx, color, x, y, Math.round(cuts[i + 1]) - x, 1);
    }
  }
}

function pillar(ctx, x, bottom, w, h) {
  const y = bottom - h;
  rect(ctx, basaltDark, x, y + 2, w, h - 2);
  rect(ctx, basalt, x + 1, y, w - 3, h - 2);
  rect(ctx, '#695663', x + 2, y + 1, Math.max(1, Math.floor(w / 3)), h - 3);
  rect(ctx, basaltLight, x + 1, y, w - 3, 2);
  rect(ctx, '#4b3f4b', x + Math.floor(w / 2), y + 5, 1, h - 6);
  rect(ctx, '#8d605c', x + 1, bottom - 3, Math.floor(w / 2), 1);
}

function basaltSpire(ctx) {
  pillar(ctx, 6, 42, 12, 21);
  pillar(ctx, 16, 41, 13, 29);
  pillar(ctx, 28, 39, 13, 36);
  pillar(ctx, 40, 43, 12, 25);
  pillar(ctx, 50, 43, 11, 17);
  pillar(ctx, 22, 46, 11, 20);
  pillar(ctx, 34, 46, 14, 12);
  for (const [x,y] of [[8,44],[18,43],[45,44],[59,42]]) rect(ctx, ember, x, y, 3, 1);
}

function lavaFalls(ctx) {
  pillar(ctx, 4, 43, 14, 19);
  pillar(ctx, 14, 39, 15, 31);
  pillar(ctx, 28, 39, 15, 35);
  pillar(ctx, 41, 42, 13, 24);
  pillar(ctx, 52, 43, 10, 15);
  rect(ctx, '#ac493d', 21, 9, 20, 28);
  rect(ctx, lava, 22, 9, 17, 27);
  rect(ctx, '#fc8c3d', 24, 11, 8, 28);
  rect(ctx, ember, 23, 10, 3, 23);
  rect(ctx, glow, 22, 9, 16, 1);
  rect(ctx, '#ffd36c', 33, 11, 2, 16);
  polygon(ctx, '#cb543b', [[20,34],[39,33],[44,38],[60,39],[64,44],[51,47],[7,45],[4,42],[17,37]]);
  polygon(ctx, lava, [[20,35],[36,35],[45,40],[58,41],[56,43],[16,43],[12,41]]);
  rect(ctx, '#ffd067', 20, 36, 12, 2);
  rect(ctx, '#ffb74c', 37, 41, 11, 1);
}

function fungus(ctx, x, base, size) {
  ctx.save();
  ctx.translate(x, base);
  ctx.scale(size, size);
  rect(ctx, '#5c344d', -3, -21, 7, 21);
  rect(ctx, '#a35067', -2, -20, 3, 20);
  rect(ctx, '#db6f70', -2, -10, 1, 7);
  rect(ctx, '#4a374a', -5, -2, 11, 3);
  polygon(ctx, '#78334f', [[-14,-19],[-13,-25],[-9,-25],[-9,-29],[7,-29],[7,-27],[13,-27],[13,-23],[16,-23],[16,-18],[-10,-18],[-10,-17],[-14,-17]]);
  rect(ctx, '#b4485a', -10, -26, 22, 5);
  rect(ctx, '#d36063', -8, -29, 15, 4);
  rect(ctx, '#e87f70', -7, -28, 6, 2);
  rect(ctx, '#edab6c', -11, -23, 3, 2);
  rect(ctx, '#edab6c', 3, -26, 4, 2);
  rect(ctx, '#cb6a68', 11, -20, 4, 1);
  for (const [dx, n] of [[-10, 6], [7, 4], [12, 7]]) {
    rect(ctx, '#a65360', dx, -18, 1, n);
    rect(ctx, '#ffa758', dx - 1, -19 + n, 2, 2);
  }
  ctx.restore();
}

function fungalGrove(ctx) {
  fungus(ctx, 45, 38, .8);
  fungus(ctx, 22, 43, 1.2);
  fungus(ctx, 51, 46, .42);
  fungus(ctx, 8, 46, .32);
}

function archBridge(ctx) {
  // Spandrels follow stepped arches, leaving the lava lake visible beneath them.
  for (const left of [238, 268, 298, 328]) {
    for (let i = 0; i < 30; i++) {
      const height = 25 - Math.floor(17 * Math.sin((i + .5) * Math.PI / 30));
      rect(ctx, basaltDark, left + i, 59, 1, height);
      rect(ctx, '#65515a', left + i, 59, 1, height - 2);
      rect(ctx, '#b17668', left + i, 57 + height, 1, 1);
    }
  }
  for (const x of [268, 298, 328]) {
    rect(ctx, '#503946', x - 3, 81, 6, 3);
    rect(ctx, '#da7849', x - 7, 84, 14, 1);
  }
  rect(ctx, '#332d3b', 234, 54, 128, 8);
  rect(ctx, '#926f76', 234, 54, 128, 2);
  rect(ctx, '#6b5361', 235, 57, 126, 3);
  for (let x = 236; x < 361; x += 11) {
    rect(ctx, '#443848', x, 49, 4, 5);
    rect(ctx, '#a37a7a', x, 48, 4, 2);
  }
  for (const x of [242, 341]) {
    rect(ctx, basaltDark, x, 40, 7, 15);
    rect(ctx, '#745965', x, 40, 2, 13);
    rect(ctx, '#38313b', x - 2, 37, 11, 4);
    rect(ctx, lava, x, 34, 7, 3);
    rect(ctx, ember, x + 2, 31, 3, 6);
    rect(ctx, glow, x + 3, 32, 1, 3);
  }
}

export function drawNetherLandscape(ctx) {
  // Deep cave, distant basalt ridges, and a bright lake under the viaduct.
  rect(ctx, '#824454', 0, 0, 480, 100);
  const haze = ['#944e58', '#af5d5c', '#c57460', '#d78b63'];
  haze.forEach((color, i) => rect(ctx,color,0,16 + 11*i,480,14));
  for (let i = 0; i < 34; i++) {
    const x = i * 15 - 5;
    const y = 30 + ((i * 13) % 21);
    rect(ctx, '#9a5962', x, y, 19, 69 - y);
    rect(ctx, '#ac6768', x + 1, y, 6, 62 - y);
    rect(ctx, '#b4746f', x + 1, y, 16, 1);
  }
  polygon(ctx, '#76465a', [[0,51],[32,44],[72,50],[108,36],[158,52],[198,42],[231,51],[284,35],[311,47],[345,37],[386,50],[416,38],[480,49],[480,73],[0,73]]);
  rect(ctx, '#bf583f', 0, 69, 480, 31);
  for (let y = 70; y < 100; y += 3) {
    for (let x = (y * 7) % 26 - 26; x < 480; x += 30) {
      rect(ctx, (x + y) % 3 === 0 ? '#ffa24c' : '#df7647', x, y, 15 + (y % 7), 1);
    }
  }
  polygon(ctx, '#584354', [[0,45],[44,41],[56,49],[104,45],[130,53],[170,47],[208,52],[239,52],[244,59],[235,67],[212,73],[168,70],[144,80],[101,73],[75,83],[0,78]]);
  polygon(ctx, '#644657', [[349,51],[370,46],[400,52],[425,43],[480,45],[480,82],[434,79],[412,71],[376,75],[355,67]]);
  for (const [x,y,n,w] of [[209,52,24,4],[216,53,18,3],[365,50,28,7],[373,50,20,3]]) {
    rect(ctx, lava, x, y, w, n);
    rect(ctx, '#ffb85e', x, y, Math.max(1, w - 3), n - 2);
    rect(ctx, '#ffda7e', x, y, w, 1);
    rect(ctx, '#f2934b', x - 3, y + n, w + 8, 2);
  }
  archBridge(ctx);
  // This ghast drifts beyond the parapet, above the far shore.
  const ghast = netherMonsterPixels.ghast;
  for (let y = 0; y < ghast.length; y++) {
    for (let x = 0; x < ghast[y].length; x++) {
      const ink = netherMonsterColors[ghast[y][x]];
      if (ink) rect(ctx, ink, 318 + x, 19 + y, 1, 1);
    }
  }
  for (const [x, base, size] of [[185,54,.65],[191,54,.35],[390,52,.7],[407,53,.9]]) fungus(ctx,x,base,size);
  for (const [x,w,h] of [[-3,19,39],[26,10,29],[58,15,16],[99,9,13],[150,17,9],[303,10,12],[357,11,17],[414,15,18],[445,14,40],[470,14,29]]) {
    rect(ctx, '#674054', x, 0, w, h);
    rect(ctx, '#8b4959', x + 2, 0, 3, h - 3);
  }
  for (let i = 0; i < 31; i++) {
    const x = (193 + 43*i) % 480, y = 4 + (57*i) % 59;
    rect(ctx, i % 4 === 0 ? '#ffc778' : '#e5956c', x, y, 1 + i % 2, 1);
  }
  polygon(ctx, '#433644', [[0,68],[35,70],[45,62],[72,65],[91,80],[115,77],[149,91],[180,93],[186,100],[0,100]]);
  polygon(ctx, '#453744', [[361,100],[376,91],[396,91],[406,78],[434,80],[448,63],[480,59],[480,100]]);
  fungus(ctx, 454, 86, 1.3);
  fungus(ctx, 425, 90, .65);
  fungus(ctx, 70, 77, 1.12);
}

export function netherTile(ctx, map, x, y, tile, seed) {
  const px = x * tile, py = y * tile, t = map[y][x];
  if (t === '~') {
    rect(ctx, '#bb4b34', px, py, tile, tile);
    rect(ctx, '#de6737', px + seed % 6, py + 3, 12, 3);
    rect(ctx, '#d75b35', px + 4, py + 12, 14, 2);
    rect(ctx, '#ef8b42', px + seed % 9, py + 5, 6, 1);
    if (map[y - 1]?.[x] !== '~') rect(ctx, '#8c3b38', px, py, tile, 2);
    return;
  }
  if (t === '.') {
    rect(ctx, (x + y) % 2 ? '#392f3b' : '#3b303c', px, py, tile, tile);
    if (seed % 3 === 0) rect(ctx, '#50404a', px + 5, py + 6, 4, 1);
    return;
  }
  rect(ctx, '#655468', px, py, tile, tile);
  rect(ctx, '#736075', px + 1, py + 2, 6, tile - 4);
  rect(ctx, '#59495a', px + 8, py + 3, 3, tile - 3);
  rect(ctx, '#786478', px + 12, py, 4, tile - 3);
  if (map[y - 1]?.[x] !== '#') rect(ctx, '#9e8593', px, py, tile, 2);
  if (map[y + 1]?.[x] !== '#') {
    rect(ctx, '#473a48', px, py + tile - 5, tile, 5);
    rect(ctx, '#af7d78', px, py + tile - 5, tile, 1);
  }
  if (map[y]?.[x - 1] !== '#') rect(ctx, '#8a7283', px, py, 1, tile - 2);
}

export function drawNetherBridges(ctx, state, tile) {
  for (const [x, y] of state.bridges) {
    const px = x * tile, py = y * tile;
    const across = state.map[y - 1]?.[x] === '~' || state.map[y + 1]?.[x] === '~';
    ctx.save();
    ctx.translate(px, py);
    if (!across) {
      ctx.translate(tile, 0);
      ctx.rotate(Math.PI / 2);
    }
    rect(ctx, '#5f4b49', 0, 0, tile, tile);
    for (let i = 0; i < tile; i += 5) {
      rect(ctx, '#9a7460', i + 1, 2, 4, tile - 4);
      rect(ctx, '#b28b6c', i + 1, 3, 1, tile - 6);
    }
    for (const rail of [0, tile - 3]) {
      rect(ctx, '#483b42', 0, rail, tile, 3);
      rect(ctx, '#e9a273', 0, rail, tile, 1);
      rect(ctx, '#725660', 2, rail, 2, 3);
    }
    ctx.restore();
  }
}

export const netherMonsterColors = {
  X: '#302737', H: '#fff1d9', K: '#dbcfc7', L: '#b9a6ae', M: '#8b798d',
  R: '#ba4c46', T: '#ef7350', B: '#793e45', E: '#ffba58', G: '#ffdf82',
};

export const netherMonsterPixels = {
  ghast: [
    '...XXXXXXXXXX...', '..XHHHHHHHHKKX..', '.XHHHHHHHHHKKLX.', '.XHHKKHHHHHKLLX.',
    '.XHHHHHHHHKKLLX.', '.XHXXKHHXXKKLLX.', '.XHKMLHHMLKKLLX.', '.XHHHKKKHHKKLLX.',
    '.XHHHHXXHHKKLLX.', '..XHKKMMKKKLLX..', '...MKKLLKKLLM...', '...KX.LX..KXM...',
    '..HK..LK..KX.L..', '..KL..LM.LK..L..', '..M...X..LM..M..', '..........X.....',
  ],
  magma_cube: [
    '................', '......XXXXX.....', '...XXXBBBRRXX...', '..XRRRTTRRBRRX..',
    '.XRRRRTTRBBRRBX.', '.XRRRRRBBBBRRBX.', '.XBGGGRBBGGGBBX.', '.XREEERBBEEEBBX.',
    '..XRRRRRRBBRRX..', '.XEEEEETTTEETTX.', '..XBBBBBRBBBBX..', '.XBRTTTTRRBBRBX.',
    '.XEEEETTTEEEETX.', '..XBBBBBBBBBBX..', '...XXXXXXXXXX...', '................',
  ],
};

const formations = { lavafall: lavaFalls, basalt_columns: basaltSpire, crimson_fungi: fungalGrove };

export function drawNetherFixture(ctx, { type, x, y, width, height }, tile) {
  const w = width * tile, h = height * tile, px = x * tile, py = y * tile;
  rect(ctx, '#51414d', px + 2, py + 2, w - 4, h - 5);
  rect(ctx, '#604751', px + 4, py + 4, w - 8, h - 10);
  rect(ctx, '#534049', px + 4, py + h - 11, w - 8, 5);
  const scale = Math.min((w - 5) / 68, (h - 5) / 48);
  ctx.save();
  ctx.translate(Math.round(px + (w - 68 * scale) / 2), Math.round(py + h - 3 - 48 * scale));
  ctx.scale(scale, scale);
  formations[type](ctx);
  ctx.restore();
}

const lavaCells = new WeakMap();

export function drawLavaFlow(ctx, state, tile) {
  if (!lavaCells.has(state.map)) {
    const cells = [];
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        if (state.map[y][x] === '~') cells.push([x,y]);
      }
    }
    lavaCells.set(state.map, cells);
  }
  const phase = Math.floor(state.time * 4);
  for (const [x,y] of lavaCells.get(state.map)) {
    const dx = 2 + (phase + x * 5 + y * 3) % 9, dy = 7 + (x * 3 + y) % 7;
    rect(ctx, '#f19b4c', x * tile + dx, y * tile + dy, 7, 1);
    rect(ctx, '#f19b4c', x * tile + dx + 6, y * tile + dy - 1, 2, 1);
    if ((phase + 3 * y + x) % 12 < 2) rect(ctx, '#ffc368', x * tile + 3, y * tile + 3, 2, 2);
  }
}
