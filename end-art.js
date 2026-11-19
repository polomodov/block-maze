// Obsidian towers rise above the End's pale, broken islands. The same silhouettes
// appear in the panorama and in the three landmarks inside the playable maze.
const obsidian = '#29243b';
const obsidianLit = '#625477';
const endStone = '#d1cb9c';
const pink = '#eb9add';
const pearl = '#fff1e1';

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function polygon(ctx, color, vertices) {
  const ys = vertices.map(point => point[1]);
  ctx.fillStyle = color;
  for (let y = Math.floor(Math.min(...ys)); y < Math.max(...ys); y++) {
    const cuts = [];
    for (let i = 0; i < vertices.length; i++) {
      const [ax, ay] = vertices[i];
      const [bx, by] = vertices[(i + 1) % vertices.length];
      if ((ay > y + .5) !== (by > y + .5)) {
        cuts.push(ax + (y + .5 - ay) * (bx - ax) / (by - ay));
      }
    }
    cuts.sort((a, b) => a - b);
    for (let i = 0; i + 1 < cuts.length; i += 2) {
      const x = Math.round(cuts[i]);
      ctx.fillRect(x, y, Math.round(cuts[i + 1]) - x, 1);
    }
  }
}

function spark(ctx, color, x, y, radius = 1) {
  rect(ctx, color, x - radius, y, radius * 2 + 1, 1);
  rect(ctx, color, x, y - radius, 1, radius * 2 + 1);
}

function crystal(ctx, x, y, r) {
  polygon(ctx, '#ab65ac', [[x,y-r-1],[x+r,y],[x,y+r+1],[x-r,y]]);
  polygon(ctx, '#efa7e0', [[x,y-r],[x+1,y],[x,y+r],[x-r+1,y]]);
  polygon(ctx, '#fbe3ed', [[x,y-r],[x+1,y-1],[x-r+1,y]]);
  rect(ctx, pearl, x - 1, y - 1, 2, 2);
}

function spire(ctx, x, bottom, width, height) {
  const top = bottom - height, lit = Math.max(2, Math.floor(width / 3));
  rect(ctx, obsidian, x, top, width, height);
  rect(ctx, '#44394f', x + 1, top + 2, lit, height - 2);
  rect(ctx, obsidianLit, x, top, width, 2);
  rect(ctx, '#19182c', x + width - 3, top + 2, 3, height - 2);
  for (let y = top + 4; y < bottom - 1; y += 7) {
    rect(ctx, '#584b66', x + 2, y, lit, 1);
    rect(ctx, '#382e47', x + width - 3, y - 2, 2, 2);
  }
  const cx = x + Math.floor(width / 2);
  rect(ctx, '#655268', x - 1, bottom - 2, width + 2, 2);
  rect(ctx, '#9c779a', cx - 4, top - 2, 8, 2);
  ctx.save();
  ctx.globalAlpha = .32;
  rect(ctx, '#c57aca', cx-5, top-12, 11, 11);
  rect(ctx, '#c57aca', cx-7, top-10, 15, 7);
  ctx.restore();
  crystal(ctx, cx, top - 7, Math.max(3, Math.floor(width / 4)));
}

function island(ctx, x, y, width, depth, far = false) {
  ctx.save();
  ctx.translate(x, y);
  const rim = far ? '#81738b' : '#aea184';
  const top = far ? '#a092a1' : endStone;
  const side = far ? '#514861' : '#857c74';
  const half = Math.round(width / 2);
  polygon(ctx, side, [[0,0],[width,0],[width-3,4],[width-9,6],[width-15,depth*.65],
    [half+3,depth],[half-10,depth*.62],[11,depth*.7],[7,5],[2,4]]);
  polygon(ctx, rim, [[0,0],[width,0],[width-6,4],[half+6,4],[half-3,depth*.56],[half-9,4],[4,3]]);
  polygon(ctx, top, [[0,0],[7,-3],[half-5,-5],[width-7,-3],[width,0],[width-8,2],[9,2]]);
  for (let i = 12; i < width - 8; i += 9) {
    const dy = Math.floor(i / 9) % 3;
    rect(ctx,rim,i,dy-2,dy+2,1);
    rect(ctx,side,i+1,4 + dy,3,1);
  }
  ctx.restore();
}

// Side view. The wing tips lift and fold against a fixed chest and a segmented tail.
function dragonShape(ctx, wing) {
  const tip = Math.round(wing * 9), tail = Math.round(wing * 2);
  polygon(ctx, '#3d304e', [[-10,-2],[-2,-10],[6,-16+tip],[6,-21+tip],[15,-25+tip],
    [30,-27+tip],[23,-21+tip],[20,-15+tip],[15,-16+tip],[11,-9],[6,-10],[2,-4],[-4,1]]);
  polygon(ctx, '#816594', [[-4,-4],[5,-15+tip],[6,-21+tip],[16,-25+tip],[30,-27+tip],
    [18,-23+tip],[10,-20+tip],[9,-14+tip],[2,-6]]);
  polygon(ctx, '#61496e', [[8,-17+tip],[15,-22+tip],[25,-25+tip],[19,-21+tip],[18,-17+tip],[14,-18+tip]]);
  polygon(ctx, '#302a3c', [[-14,1],[-29,3],[-38,5+tail],[-53,2+tail],[-43,7+tail],[-36,8+tail],[-23,5],[-10,6]]);
  polygon(ctx, '#867791', [[-51,3+tail],[-37,5+tail],[-26,3],[-18,2],[-23,4],[-37,7+tail]]);
  polygon(ctx, '#292433', [[-16,-1],[-7,-5],[6,-4],[13,-1],[21,-5],[26,-8],[30,-6],[24,-2],[17,2],[8,4],[2,6],[-8,7],[-16,4]]);
  rect(ctx, '#594e64', -13, -1, 12, 2);
  polygon(ctx, '#62566c', [[4,3],[13,0],[23,-5],[27,-8],[22,-3],[14,2],[6,5]]);
  for (const [x,y] of [[-24,2],[-18,1],[8,-3],[15,-4],[20,-6]]) {
    rect(ctx, '#aa9aaf', x, y-2, 2, 2);
  }
  polygon(ctx, '#242231', [[3,0],[-4,-16],[-11,-23+tip],[-23,-29+tip],[-35,-28+tip],
    [-27,-22+tip],[-24,-14+tip],[-17,-15+tip],[-13,-7],[-8,-9],[-3,0]]);
  polygon(ctx, '#63466e', [[0,-4],[-6,-16],[-15,-23+tip],[-29,-26+tip],
    [-24,-21+tip],[-23,-16+tip],[-18,-18+tip],[-13,-10],[-8,-12]]);
  polygon(ctx, '#c69bc8', [[2,-3],[-4,-17],[-13,-25+tip],[-23,-29+tip],[-35,-28+tip],
    [-22,-27+tip],[-13,-23+tip],[-6,-16]]);
  polygon(ctx, '#8b7594', [[-14,-22+tip],[-22,-25+tip],[-17,-17+tip]]);
  rect(ctx, '#292432', -11, 5, 3, 7);
  rect(ctx, '#72657c', -13, 10, 4, 2);
  rect(ctx, '#302635', 1, 4, 3, 5);
  rect(ctx, '#83748e', -1, 8, 4, 2);
  rect(ctx, '#272232', 24, -11, 10, 8);
  rect(ctx, '#a387ad', 24, -11, 10, 2);
  rect(ctx, '#b1a3b6', 25, -14, 2, 4);
  rect(ctx, '#8f7a9a', 29, -13, 2, 2);
  rect(ctx, '#443749', 33, -8, 7, 4);
  rect(ctx, '#292232', 33, -5, 8, 3);
  rect(ctx, '#ac83ac', 35, -7, 4, 1);
  rect(ctx, '#d17ee2', 29, -8, 5, 3);
  rect(ctx, '#ffdcff', 32, -8, 1, 1);
}

// Reuse each wing pose so the mobile canvas only blits a small, crisp sprite per frame.
const dragonFrames = new Map();
function dragonFrame(pose) {
  if (dragonFrames.has(pose)) return dragonFrames.get(pose);
  const image = document.createElement('canvas');
  image.width = 96;
  image.height = 53;
  const ctx = image.getContext('2d');
  ctx.translate(54,40);
  dragonShape(ctx,pose/4);
  dragonFrames.set(pose,image);
  return image;
}

function chorus(ctx, x, base, height) {
  const top = base - height;
  rect(ctx, '#68516e', x, top, 4, height);
  rect(ctx, '#ad88ac', x, top, 1, height);
  for (const [dir, dy, w] of [[-1,7,7],[1,14,8]]) {
    const bx = dir < 0 ? x - w : x + 2;
    rect(ctx, '#815e82', bx, top + dy, w, 3);
    const ex = dir < 0 ? bx : bx + w - 2;
    rect(ctx, '#946f98', ex, top + dy - 5, 3, 7);
    rect(ctx, '#705376', ex-1, top+dy-8, 5, 4);
    rect(ctx, '#c39abc', ex, top+dy-8, 3, 1);
  }
  rect(ctx, '#7c6180', x-2, top-4, 7, 6);
  rect(ctx, '#ceacc6', x-1, top-4, 4, 2);
}

export function drawEndLandscape(ctx) {
  const bands = ['#211d37','#2b2240','#352847','#443050','#553d5d','#70516c','#876879'];
  bands.forEach((color, i) => {
    const y = i*15;
    rect(ctx, color, 0, y, 480, 16);
    if (!i) return;
    // Broken banks of nebula follow the horizon behind the towers.
    for (let x=0; x<480; x+=5) {
      const rise = Math.round(3+2*Math.sin(x/28+i)+2*Math.sin(x/15-i));
      rect(ctx,color,x,y-rise,5,rise);
    }
  });
  for (let i = 0; i < 59; i++) {
    const x = (i * 67 + i * i * 7) % 480, y = (i * 37 + 3) % 61;
    if (i % 13 === 0) spark(ctx, '#c3acc4', x, y);
    else rect(ctx, i%2 ? '#97829e' : '#65546f', x,y,1,1);
  }
  island(ctx, 57, 43, 54, 14, true);
  island(ctx, 177, 61, 70, 18, true);
  island(ctx, 393, 48, 58, 13, true);
  island(ctx, -15, 75, 102, 24);
  spire(ctx, 33, 72, 11, 36);
  island(ctx, 155, 89, 101, 22);
  chorus(ctx, 199, 85, 17);
  chorus(ctx, 224, 86, 13);
  island(ctx, 254, 79, 141, 29);
  spire(ctx, 278, 77, 15, 40);
  spire(ctx, 314, 75, 12, 26);
  spire(ctx, 353, 76, 15, 33);
  island(ctx, 405, 88, 95, 19);
  spire(ctx, 450, 85, 17, 51);
  chorus(ctx, 423, 85, 17);
  ctx.save();
  ctx.translate(323, 37);
  ctx.scale(1.19,1.19);
  ctx.drawImage(dragonFrame(1),-54,-40);
  ctx.restore();
}

// Floor is cool, nearly black stone. Tiny edge reflections leave the centers clear for gems.
export function endTile(ctx, map, x, y, tile, seed) {
  const px = x * tile, py = y * tile;
  if (map[y][x] === '.') {
    rect(ctx, ['#282b3a','#2a2b3b','#292c3c'][seed % 3], px, py, tile, tile);
    const joint = 3 + (5 * x + 7 * y) % 13;
    rect(ctx, '#242635', px, py + tile - 2, tile, 2);
    rect(ctx, '#333343', px + joint, py + tile - 3, tile - joint, 1);
    rect(ctx, '#252737', px + joint, py + tile - 5, 1, 3);
    if (seed % 4 === 0) {
      rect(ctx, '#494852', px + 3, py + 5, 3, 1);
      rect(ctx, '#373947', px + 6, py + 4, 2, 1);
    }
    return;
  }

  const north = map[y-1]?.[x] !== '#', south = map[y+1]?.[x] !== '#';
  const west = map[y][x-1] !== '#', east = map[y][x+1] !== '#';
  const h = south ? tile - 6 : tile;
  rect(ctx, ['#afa77d','#b7ae82','#b2a980','#bab386'][seed%4], px, py, tile, h);

  // Shallow hollows and horizontal seams give end stone its porous, layered surface.
  const pit = 2 + seed % 10, band = 2 + (seed >> 3) % 6;
  rect(ctx, '#a19a78', px + pit, py + band, 5, 2);
  rect(ctx, '#8f8970', px + pit, py + band, 3, 1);
  rect(ctx, '#c8c096', px + pit + 1, py + band + 2, 5, 1);
  rect(ctx, '#c1b990', px + (pit + 7) % 15, py + band + 5, 4, 1);
  if (seed % 3 === 0) {
    rect(ctx, '#aea680', px + 2, py + 9, 5, 1);
    rect(ctx, '#d1cba1', px + 3, py + 10, 2, 1);
  }
  if (seed % 23 === 0) {
    // A pale geode in the wall catches the violet sky light.
    for (const [dx,dy] of [[5,8],[7,6],[10,7],[12,5]]) {
      rect(ctx,'#96889a',px+dx,py+dy,3,2);
      rect(ctx,'#c9b5bc',px+dx,py+dy-1,2,2);
      rect(ctx,'#e6d6cf',px+dx,py+dy-1,1,1);
    }
  }
  if (north) {
    rect(ctx, '#d2cda0', px, py, tile, 2);
    rect(ctx, '#eee4b1', px + 2, py, 5 + seed % 7, 1);
    rect(ctx, '#c2b98d', px + 1, py + 2, tile - 1, 1);
  }
  if (west) rect(ctx, '#c7c198', px, py + 1, 2, h - 1);
  if (east) rect(ctx, '#8a866e', px + tile - 2, py + 2, 2, h - 2);
  if (south) {
    rect(ctx, '#777268', px, py + h, tile, 5);
    rect(ctx, '#514e53', px, py + tile - 1, tile, 1);
    rect(ctx, '#9e927d', px, py + h, tile, 1);
    rect(ctx, '#d5c9a0', px + 1, py + h - 1, tile - 3, 1);
    rect(ctx, '#655e61', px + pit, py + h + 2, 2, 3);
    rect(ctx, '#bbb095', px + pit + 2, py + h + 2, 4, 1);
    if (seed % 5 === 0) rect(ctx, '#a091ac', px + 2, py + h + 3, 4, 1);
  }
}

function groundShard(ctx, x, y, size) {
  polygon(ctx, '#765d97', [[x-2,y],[x-2,y-4],[x,y-size],[x+3,y-3],[x+3,y]]);
  rect(ctx, '#b9add6', x, y-size+2, 1, size-2);
}

function endPedestal(ctx, x, base, w, h) {
  const top = base - h, mid = x + Math.floor(w / 2);
  polygon(ctx, '#252436', [[x,top+2],[mid,top-1],[x+w,top+2],[x+w,base],[mid,base+2],[x,base]]);
  rect(ctx, '#44394f', x+1, top+3, mid-x-1, h-4);
  rect(ctx, '#322b42', mid, top+3, w-(mid-x)-1, h-4);
  rect(ctx, '#675579', x+1, top+3, 2, h-5);
  for (let n = 6; n < h-4; n += 6) {
    rect(ctx, '#4c405b', mid+1, top+n, 3, 2);
    rect(ctx, '#69576e', x+2, top+n+2, 3, 1);
  }
  polygon(ctx, '#655678', [[x-1,top+1],[mid,top-2],[x+w+1,top+1],[mid,top+4]]);
  rect(ctx, '#b298ae', mid-2, top, 5, 1);
  polygon(ctx, '#9181aa', [[mid,top-17],[mid+8,top-10],[mid,top-2],[mid-8,top-10]]);
  polygon(ctx, '#443453', [[mid,top-15],[mid+6,top-10],[mid,top-4],[mid-6,top-10]]);
  crystal(ctx, mid, top-10, 4);
  rect(ctx, '#e0eff7', mid-1, top-12, 2, 2);
  spark(ctx, '#d5eff0', mid-5, top-10);
}

const fixtures = {
  crystal_spires(ctx) {
    endPedestal(ctx, 8, 35, 10, 11);
    endPedestal(ctx, 48, 35, 9, 14);
    endPedestal(ctx, 25, 39, 15, 21);
    groundShard(ctx, 18, 39, 5);
    groundShard(ctx, 51, 40, 4);
  },
  exit_portal(ctx) {
    // Two bedrock rims enclose an inky pool; a faceted dragon egg stands in its center.
    polygon(ctx,'#40384d',[[3,28],[18,20],[46,18],[63,24],[62,32],[48,39],[19,40],[3,33]]);
    polygon(ctx,'#75687e',[[3,27],[18,19],[47,17],[63,24],[58,29],[46,34],[19,35],[3,30]]);
    polygon(ctx,'#ae9bae',[[4,27],[18,19],[45,17],[47,18],[19,21],[7,28]]);
    polygon(ctx,'#191d36',[[11,27],[22,22],[46,20],[55,24],[53,27],[43,31],[21,32]]);
    polygon(ctx,'#3c3f62',[[12,28],[21,28],[26,30],[39,29],[46,26],[51,26],[44,30],[22,32]]);
    for (const [x,y] of [[17,26],[43,23],[49,25],[26,30],[37,22]]) rect(ctx,'#ccbfed',x,y,1,1);
    for (const [x,y] of [[13,33],[22,36],[38,35],[50,32],[56,29]]) rect(ctx,'#96869f',x,y,3,1);
    rect(ctx,'#383449',29,11,8,15);
    rect(ctx,'#8d8091',29,13,3,12);
    rect(ctx,'#b9a6ad',28,11,10,2);
    polygon(ctx,'#261e35',[[26,10],[25,7],[27,6],[27,3],[30,2],[31,0],[34,0],[36,3],[39,5],[40,9],[37,12],[29,12]]);
    rect(ctx,'#655078',28,5,4,2);
    rect(ctx,'#c0a4c5',30,3,3,2);
    rect(ctx,'#8b6697',36,8,2,2);
    for (const [x,y] of [[20,24],[46,24]]) {
      rect(ctx,'#443248',x,y,2,4);
      rect(ctx,'#b49ac1',x-1,y-1,4,2);
      rect(ctx,'#ead3d8',x,y-3,2,2);
    }
  },
  chorus_grove(ctx) {
    groundShard(ctx, 9, 38, 7);
    chorus(ctx, 14, 39, 18); chorus(ctx, 34, 39, 30); chorus(ctx, 52, 37, 21);
    for (const [x,y] of [[14,18],[34,6],[52,13],[27,8],[43,16]]) {
      rect(ctx,'#9b749a',x-2,y-1,5,4);
      rect(ctx,'#d2b2c3',x-1,y-2,3,2);
      rect(ctx,'#f1d7d7',x-1,y-1,1,1);
    }
    for (const [x,y] of [[20,39],[28,40],[44,39],[56,38]]) rect(ctx,'#9b809a',x,y,3,1);
  },
};

export function drawEndFixture(ctx, { type, x, y, width, height }, tile) {
  const w = width * tile, h = height * tile;
  const cx = (x + width * .5) * tile, cy = (y + height * .45) * tile;
  const glow = ctx.createRadialGradient(cx,cy,3,cx,cy,w*.65);
  const tone = type === 'exit_portal' ? '99,123,168' : '162,128,191';
  glow.addColorStop(0,'rgba('+tone+',.34)');
  glow.addColorStop(.65,'rgba('+tone+',.13)');
  glow.addColorStop(1,'rgba('+tone+',0)');
  rect(ctx,glow,cx-w*.65,cy-w*.65,w*1.3,w*1.3);
  const scale = Math.min((w-6)/66,(h-7)/45);
  ctx.save();
  ctx.translate(Math.round(x*tile+(w-66*scale)/2),Math.round(y*tile+h-5-45*scale));
  ctx.scale(scale,scale);
  // Exposed strata give each landmark a detached island silhouette instead of a rectangular base.
  island(ctx,0,37,66,8);
  polygon(ctx,'#aa9b87',[[4,36],[15,32],[34,33],[45,31],[62,35],[58,38],[19,40]]);
  polygon(ctx,'#c7b99b',[[4,35],[15,32],[35,32],[45,30],[61,34],[51,35],[33,34],[18,36]]);
  fixtures[type](ctx);
  ctx.restore();
}

// A moonlit silhouette keeps the Enderman’s long limbs visible on the dark walkways.
export const endermanColors = {
  C:'#716887', D:'#3e344d', E:'#927897', M:'#efa0ff', N:'#fff4d9',
};

export const endMonsterColors = {
  a:'#382c48', b:'#594567', c:'#896789', d:'#b58eaa', e:'#d6aec0',
  f:'#dac99e', g:'#ffebbe', h:'#4b423e', i:'#46394f', j:'#261f30',
  k:'#887792', l:'#e99ffe', m:'#ffdbff',
};
export const endMonsterPixels = {
  shulker: [
    '................','....aaaaaaaa....','..abcdddeeddba..','.acddccddddccba.',
    '.abddccdeeddcba.','.abccdddddddcca.','..aaaaaaaaaaaa..','....hfffffhh....',
    '....fghffhgf....','....fffffffh....','.abbbbbbbbbbbba.','.acdddddddddcca.',
    '.abcdccddcccda..','..abccdccccba...','...aaaaaaaaa....','................',
  ],
  ender_dragon: [
    '...kk.....kk....','...kiij..iik....','..jiiiiiiiiij...','..jikkkiiiiij...',
    '.jjiijjiiiiijj..','.jjlmljjlmljij..','..jjiiiiiiiij...','..jjjijjjjiij...',
    '....jjiijjjj....','....jiikkiij....','...jiiijjiiij...','...jjjijjijjj...',
    '....jjjjjjjj....','.....jiijij.....','......jjjj......','................',
  ],
};

function warning(ctx, x, y, tile, time) {
  const size = 5 + Math.floor(time * 4) % 2;
  const cx = Math.round((x+.5)*tile), cy = Math.round((y+.5)*tile);
  for (const dx of [-1,1]) for (const dy of [-1,1]) {
    const px = cx + size * dx, py = cy + size * dy;
    rect(ctx, '#52264f', px-2,py-2,5,5);
    rect(ctx, '#ffbaf6', dx<0 ? px : px-2,py,3,1);
    rect(ctx, '#ffbaf6', px,dy<0 ? py : py-2,1,3);
  }
}

function cloud(ctx, effect, tile, time) {
  const cx=(effect.x+.5)*tile, cy=(effect.y+.5)*tile, age=3-effect.remaining;
  // Clip each billow to the occupied tile so safe neighbouring corridors stay readable.
  ctx.save();
  ctx.beginPath();ctx.rect(cx-tile/2,cy-tile/2,tile,tile);ctx.clip();
  ctx.globalAlpha*=Math.min(1,.58+age*5,.50+effect.remaining*2);
  const seed=effect.x*2.7+effect.y;
  for(let i=0;i<5;i++){
    const angle=seed+i*1.26+age*.82, r=2.5+i%2;
    const x=cx+Math.cos(angle)*r, y=cy+Math.sin(angle)*r*.7;
    const radius=3.6+.95*Math.sin(age*3+i)+Math.min(age,1)*.75;
    ctx.beginPath();ctx.ellipse(x,y,radius+.65,radius,0,0,Math.PI*2);
    ctx.fillStyle=i%2?'#a85ac3':'#794e9d';ctx.fill();
    ctx.beginPath();ctx.arc(x-.4,y-.5,radius*.72,3.6,5);
    ctx.strokeStyle='#e59be3';ctx.lineWidth=.85;ctx.stroke();
  }
  for(let i=0;i<3;i++){
    const t=(age*1.4+i/3)%1;
    ctx.fillStyle='#ffd7fb';
    ctx.fillRect(cx+Math.sin(seed+i*3.1+t)*5.4,cy-t*6.8,1.3,1.2);
  }
  ctx.restore();
}

export function drawEndThreats(ctx,state,tile) {
  const dragon = state.dragon;
  if (dragon && dragon.phase !== 'patrol') {
    for (const [x,y] of dragon.cells) warning(ctx,x,y,tile,state.time);
  }
  for (const effect of state.effects) {
    if (effect.type === 'dragon_breath') cloud(ctx,effect,tile,state.time);
    if (effect.type === 'shulker_bolt') {
      const x = Math.round((effect.x+.5)*tile), y = Math.round((effect.y+.5)*tile);
      const offset = {left:[1,0], right:[-1,0], up:[0,1], down:[0,-1]}[effect.dir] || [0,0];
      rect(ctx,'#966997',x+4*offset[0]-1,y+4*offset[1]-1,2,2);
      rect(ctx,'#e4c0d8',x-3,y-2,7,5);
      rect(ctx,'#aab2bb',x-2,y-3,5,7);
      rect(ctx,'#f9f5d4',x-2,y-2,4,4);
      spark(ctx,pearl,x,y);
    }
  }
}

export function drawFlyingDragon(ctx,state,tile) {
  const dragon = state.dragon;
  if (!dragon) return;
  const x=(dragon.x+.5)*tile, y=(dragon.y+.5)*tile;
  const wing=Math.sin(state.time*3.6);
  ctx.save();
  ctx.translate(x,y-3+wing*.7);
  const scale=.64;
  ctx.scale(dragon.dir==='left'?-scale:scale,scale);
  ctx.rotate(wing*.025);
  ctx.drawImage(dragonFrame(Math.round(wing*4)),-54,-40);
  if (dragon.phase==='breathing') {
    const ahead=dragon.cells.reduce((nearest,[tx])=>Math.min(nearest,Math.abs(tx-dragon.x)),Infinity);
    const breath=Math.max(0,1-ahead/4.6);
    if (breath>0) {
      const glow=ctx.createRadialGradient(38,-4,0,38,-4,8);
      glow.addColorStop(0,'rgba(255,217,255,'+breath+')');glow.addColorStop(1,'rgba(194,105,247,0)');
      ctx.fillStyle=glow;ctx.fillRect(30,-12,16,16);
      for(let i=0;i<5;i++){
        const t=(state.time*2.7+i/5)%1;
        ctx.beginPath();ctx.ellipse(39+t*11,-3+t*t*14+Math.sin(t*5+i)*1.15,1.4+2*t,1.2+2*t,0,0,Math.PI*2);
        ctx.fillStyle='rgba(227,147,244,'+((1-t)*.8*breath)+')';ctx.fill();
      }
    }
  }
  ctx.restore();
}
