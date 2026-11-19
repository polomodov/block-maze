import { arcadeTile, drawArcadeLandscape, drawAttraction, drawRideLights } from './arcade-art.js?v=parks-1';
import { drawStoreLandscape, storeTile, drawStoreFixture, storeMonsterPixels, storeMonsterColors } from './store-art.js?v=parks-1';
import { drawMonsterEffects, showCharge, showSlow } from './monster-art.js?v=parks-1';
import { drawWaterparkLandscape, drawWaterRide, waterparkTile, waterRipples, drawRideAccess, riderPosition } from './waterpark-art.js?v=parks-1';

// The artwork is drawn on integer grids and scaled by the browser as pixel art.
function surface(canvas, width, height) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function box(ctx, ink, x, y, width, height) {
  ctx.fillStyle = ink;
  ctx.fillRect(x, y, width, height);
}

// Fill polygon spans with whole pixels, including the diagonal edges of cubes.
function shape(ctx, ink, points) {
  const rows = points.map(point => point[1]);
  ctx.fillStyle = ink;
  for (let y = Math.min(...rows); y < Math.max(...rows); y++) {
    const cuts = [];
    const scan = y + 0.5;
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= scan && y2 > scan) || (y2 <= scan && y1 > scan)) {
        cuts.push(x1 + (scan - y1) * (x2 - x1) / (y2 - y1));
      }
    }
    cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length; i += 2) {
      const left = Math.round(cuts[i]);
      ctx.fillRect(left, y, Math.round(cuts[i + 1]) - left, 1);
    }
  }
}

function randomSequence(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function ridge(ctx, base, amplitude, step, color, seed) {
  const rand = randomSequence(seed);
  let current = base;
  for (let x = 0; x < 483; x += step) {
    current = Math.min(base + amplitude, Math.max(base - amplitude, current + Math.floor(rand() * 9) - 4));
    box(ctx, color, x, current, step, 110 - current);
  }
}

function canopy(ctx, x, y, size, palette, seed) {
  const rand = randomSequence(seed);
  const [shadow, leaf, light] = palette;
  const unit = Math.max(1, Math.round(size / 8));
  box(ctx, shadow, x - size, y, size * 2, 4 * unit);
  box(ctx, shadow, x - size + unit * 2, y + unit, size * 2 - unit * 4, unit * 4);
  box(ctx, leaf, x - size + unit, y - unit, size * 2 - unit * 2, 3 * unit);
  box(ctx, leaf, x - size + 3 * unit, y - 2 * unit, size * 2 - 6 * unit, unit * 2);
  for (let i = 0; i < size; i++) {
    const dx = Math.floor(rand() * (size * 2 - unit * 4));
    const dy = Math.floor(rand() * (unit * 3));
    box(ctx, i % 3 === 0 ? shadow : light, x - size + 2 * unit + dx, y - unit + dy, unit + Math.floor(rand() * unit), unit);
  }
}

function tree(ctx, x, y, width, floor, palette, seed) {
  const [dark, leaf] = palette;
  const trunk = Math.max(2, Math.floor(width / 5));
  box(ctx, dark, x - trunk, y, trunk * 2, floor - y);
  box(ctx, leaf, x - trunk, y + 3, Math.ceil(trunk / 2), floor - y - 3);
  box(ctx, dark, x - trunk - 4, floor - 4, trunk * 2 + 8, 4);
  shape(ctx, dark, [[x, y + 16], [x - width + 2, y + 4], [x - width + 6, y + 4], [x, y + 11]]);
  canopy(ctx, x, y, width, palette, seed);
}

function temple(ctx, x, ground, scale) {
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(scale, scale);
  const r = (c, a, b, w, h) => box(ctx, c, a, b, w, h);
  const top = '#69907a', facade = '#496b61', dark = '#375957';
  r(dark,-38,-5,76,5);
  r(facade,-35,-8,70,5);
  r(top,-35,-9,70,2);
  for (let i = 0; i < 3; i++) {
    const half = 30 - 5 * i, bottom = -10 - 4 * i;
    r(facade,-half,bottom-2,half*2,4);
    r(top,-half,bottom-3,half*2,1);
    r(dark,half-9,bottom-2,9,4);
    r(dark,-half+7+i*2,bottom-2,1,2);
  }
  r(dark,-13,-29,26,11);
  r(facade,-12,-30,20,11);
  r(dark,-3,-28,6,10);
  r(top,-16,-32,32,3);
  r(dark,6,-31,10,2);
  r(facade,-12,-35,23,3);
  r(top,-7,-38,13,3);
  for (let i = 0; i < 8; i++) {
    r(i%2 ? top : '#8da488',-6-i,-18+i*2,12+i*2,1);
  }
  ctx.restore();
}

const levelArt = {
  arcade: { landscape: drawArcadeLandscape, tile: arcadeTile, fixture: drawAttraction, animate: drawRideLights },
  waterpark: { landscape: drawWaterparkLandscape, tile: waterparkTile, fixture: drawWaterRide, animate: waterRipples },
  store: { landscape: drawStoreLandscape, tile: storeTile, fixture: drawStoreFixture },
};

export function drawLandscape(canvas, levelId = 'temple') {
  const ctx = surface(canvas, 480, 100);
  const theme = levelArt[levelId];
  if (theme) {
    theme.landscape(ctx);
    return;
  }
  box(ctx, '#7ca6a2', 0, 0, 480, 100);
  box(ctx, '#8ab1a8', 0, 32, 480, 18);
  box(ctx, '#a8bba5', 0, 50, 480, 50);
  // Shafts of late afternoon light and low, flat cloud banks.
  for (const [x,y,w] of [[208,12,28],[230,14,19],[326,22,35],[344,20,18],[122,32,30],[98,33,35],[275,38,37],[265,40,23],[396,8,19]]) {
    box(ctx,'#b3c6b1',x,y,w,2);
  }
  shape(ctx,'#f2d58d',[[368,13],[383,13],[383,15],[387,15],[387,19],[390,19],[390,32],[387,32],[387,36],[383,36],[383,38],[368,38],[368,36],[364,36],[364,32],[361,32],[361,19],[364,19],[364,15],[368,15]]);
  box(ctx,'#ffe5a2',368,16,15,4);
  ridge(ctx,54,21,6,'#7e9f95',83);
  shape(ctx,'#71978d',[[110,68],[150,40],[161,39],[167,32],[180,32],[217,60],[232,55],[264,74],[110,80]]);
  shape(ctx,'#73978e',[[274,75],[312,44],[332,44],[332,42],[343,42],[343,49],[353,49],[379,73]]);
  ridge(ctx,66,10,4,'#577f71',120);
  const distant = ['#557b6c','#628b74','#78977b'];
  for (const [x,y,w] of [[15,42,16],[102,59,11],[122,55,8],[208,60,11],[243,53,14],[264,52,11],[279,56,10],[391,48,15],[423,46,13],[464,35,18]]) {
    tree(ctx,x,y,w,86,distant,7*x);
  }
  temple(ctx,320,88,1);
  temple(ctx,413,94,1);
  ridge(ctx,84,8,3,'#3a6358',140);
  const middle = ['#335a52','#416c57','#557c5f'];
  for (const [x,y,w] of [[25,36,22],[83,50,16],[147,69,10],[197,67,15],[221,58,10],[402,61,13],[444,49,21]]) {
    tree(ctx,x,y,w,98,middle,x+3);
  }
  // Fern-like silhouettes frame the vista without covering the temple.
  const front = ['#1d403c','#2e5747','#456b4d'];
  tree(ctx,18,3,37,100,front,29);
  tree(ctx,459,8,31,100,front,83);
  canopy(ctx,478,-2,27,front,15);
  canopy(ctx,48,-3,24,front,41);
  for (const [x,y,length] of [[38,8,24],[52,7,38],[60,4,18],[67,1,16],[434,12,14],[445,7,29],[472,6,33]]) {
    box(ctx,front[1],x,y,1,length);
    for (let n=1; n<length-1; n+=6) box(ctx,front[n%2],x+(n%4===1 ? -2 : 1),y+n,2,3);
  }
  ridge(ctx,94,5,3,'#2a5144',99);
  for (const x of [0,7,39,57,85,128,198,255,385,407,436,462,476]) {
    shape(ctx,front[0],[[x-8,100],[x-12,91],[x-5,94],[x-7,85],[x,92],[x+4,82],[x+5,93],[x+13,89],[x+8,100]]);
  }
}

const parentBackdrops = {
  mom: ['#9989b3','#8e7ca8','#796997','#6f648b','#555676','#b3a0c3'],
  dad: ['#98aba3','#899e97','#798f85','#657e77','#516a65','#b0c1af'],
};

function portraitBackdrop(ctx, hero) {
  const p = parentBackdrops[hero] || (hero === 'kirill' ? ['#75a8a2','#679996','#548684','#487470','#385f56','#82aaa1'] :
    ['#b9a073','#ae9264','#9b825d','#867653','#6b6147','#c3ad7c']);
  box(ctx,p[0],0,0,96,72);
  box(ctx,p[5],56,7,40,2);
  box(ctx,p[5],48,9,37,1);
  shape(ctx,p[1],[[0,40],[18,25],[27,25],[36,20],[46,21],[63,38],[80,21],[96,24],[96,72],[0,72]]);
  for (const [x,y,w,h] of [[0,37,16,35],[14,41,9,31],[17,45,12,27],[73,44,14,28],[86,36,10,36],[78,34,7,12]]) {
    box(ctx,p[2],x,y,w,h);
    box(ctx,p[3],x,y,w,2);
  }
  for (const [x,y,w,h] of [[0,48,12,8],[0,56,19,8],[5,64,19,8],[81,57,15,7],[85,50,11,7],[91,43,5,7]]) {
    box(ctx,p[3],x,y,w,h);
    box(ctx,p[2],x+1,y+1,w-2,1);
    box(ctx,p[4],x,y+h-1,w,1);
  }
  for (const [x,y] of [[6,49],[12,58],[85,59],[0,67],[92,51]]) {
    box(ctx,p[2],x,y,3,2);
  }
}

// The parents have taller silhouettes and their own hairstyle, clothes and expressions.
function drawParent(ctx, hero) {
  const mom = hero === 'mom';
  const edge = mom ? '#393448' : '#423d36';
  const jacket = mom ? '#8868b3' : '#cb943d';
  const light = mom ? '#b494d6' : '#efb654';
  const shade = mom ? '#5c508a' : '#9d6e38';
  const hair = mom ? '#75453b' : '#624537';
  const darkHair = mom ? '#493342' : '#433b38';
  const skin = '#e4ac80', skinLight = '#f2c599', skinShadow = '#be8768';
  const r = (c, x, y, w, h) => box(ctx, c, x, y, w, h);
  const poly = (color, vertices) => shape(ctx, color, vertices);
  poly(edge, [[13,72],[14,58],[23,49],[36,44],[59,43],[74,48],[84,56],[87,72]]);
  poly(shade, [[16,72],[17,57],[29,48],[60,46],[74,51],[82,58],[84,72]]);
  poly(jacket, [[27,72],[27,55],[40,46],[56,46],[67,53],[68,72]]);
  poly(light, [[16,58],[25,50],[33,47],[36,50],[27,55],[19,62]]);
  poly(light, [[62,49],[67,48],[76,52],[73,54],[67,55]]);
  poly(jacket, [[74,55],[79,55],[83,60],[84,69],[72,68]]);
  r(shade, 24, 58, 2, 13);
  r(light, 76, 60, 4, 2);
  r(skinShadow, 38, 40, 18, 10);
  r(skin, 38, 46, 13, 4);
  if (mom) {
    poly('#d9caeb', [[33,48],[39,45],[44,51],[51,48],[59,45],[60,50],[46,57],[36,54]]);
    poly('#c3a9d9', [[44,55],[49,53],[56,61],[51,65]]);
    r('#dac5e8', 50, 60, 3, 2);
    // A braided bun and a lock of hair continue behind the far shoulder.
    poly(darkHair, [[57,17],[61,7],[67,3],[75,4],[81,10],[81,19],[75,25],[72,38],[64,50],[58,50]]);
    poly(hair, [[60,13],[64,7],[71,6],[77,9],[78,15],[72,20],[67,20]]);
    r('#a46951', 66, 8, 6, 2);
    poly('#d399b7', [[61,14],[66,15],[73,22],[70,24],[62,17]]);
  } else {
    poly('#b25142', [[33,47],[38,44],[46,49],[58,44],[64,48],[53,52],[44,57],[35,53]]);
    poly('#d66750', [[43,53],[53,51],[49,60],[45,64]]);
    r('#fa9471', 45, 54, 3, 2);
    r(shade, 56, 60, 10, 7);
    r(light, 56, 60, 10, 2);
    r('#ffda8c', 61, 62, 2, 1);
  }
  poly(edge, [[27,13],[43,5],[56,5],[69,12],[69,34],[61,43],[51,48],[29,44],[26,38]]);
  poly(skinShadow, [[51,19],[67,13],[67,34],[59,42],[51,46],[49,39]]);
  poly(skin, [[28,17],[52,19],[52,43],[49,46],[30,42],[28,38]]);
  poly(skinLight, [[29,23],[49,24],[49,36],[37,36],[36,39],[30,39]]);
  poly(hair, [[27,13],[43,6],[55,6],[68,12],[53,22],[28,19]]);
  poly(darkHair, [[52,20],[67,13],[67,26],[61,30],[58,26],[54,29],[52,28]]);
  poly(skin, [[58,29],[64,26],[64,33],[59,36]]);
  r(skinShadow, 60, 29, 2, 3);
  if (mom) {
    poly(hair, [[28,15],[41,10],[54,13],[54,18],[48,22],[38,22],[37,25],[30,25],[26,31],[25,26]]);
    poly('#a96b50', [[29,17],[39,11],[48,9],[53,10],[43,13],[37,17]]);
    poly(darkHair, [[52,20],[56,19],[56,30],[60,33],[63,29],[63,35],[59,39],[54,36]]);
    r('#f5cd74', 61, 34, 2, 3);
    r(darkHair, 29, 26, 7, 1);
    r(darkHair, 43, 26, 6, 1);
    r('#fff1df', 29, 29, 7, 4);
    r('#fff1df', 43, 29, 7, 4);
    r('#3d4244', 30, 29, 4, 3);
    r('#3d4244', 44, 29, 4, 3);
    r('#fff1df', 30, 29, 1, 1);
    r('#fff1df', 44, 29, 1, 1);
    r(skinShadow, 36, 33, 4, 2);
    r('#c17b69', 30, 35, 4, 1);
    r('#c17b69', 46, 35, 4, 1);
    r('#a05b58', 35, 39, 9, 2);
    r('#ffe8d5', 36, 39, 6, 1);
  } else {
    poly(hair, [[26,14],[27,10],[32,10],[33,6],[38,7],[46,4],[54,5],[64,10],[53,16],[45,16],[41,19],[35,19]]);
    poly('#90735b', [[29,12],[37,7],[42,8],[35,12]]);
    r('#978776', 61, 21, 5, 2);
    // Thick square frames, an open smile and a short salt-and-pepper beard.
    r(darkHair, 27, 25, 11, 7);
    r(darkHair, 41, 25, 12, 7);
    r(darkHair, 36, 26, 8, 2);
    poly(darkHair, [[52,25],[64,22],[64,24],[52,27]]);
    r('#f2d1a8', 29, 26, 7, 4);
    r('#f2d1a8', 43, 26, 8, 4);
    r(edge, 31, 27, 3, 3);
    r(edge, 45, 27, 3, 3);
    r('#fff0d4', 31, 27, 1, 1);
    r('#fff0d4', 45, 27, 1, 1);
    r(skinShadow, 37, 31, 4, 3);
    poly(hair, [[29,34],[32,36],[34,38],[41,37],[48,37],[52,33],[57,31],[57,36],[52,44],[48,46],[32,43],[29,39]]);
    r('#92745f', 31, 38, 2, 2);
    r('#92745f', 48, 41, 3, 2);
    r('#513b38', 35, 38, 10, 4);
    r('#fff1d4', 35, 38, 9, 2);
    r('#ba796a', 38, 41, 5, 1);
  }
}

export function drawPortrait(canvas, hero) {
  const ctx = surface(canvas,96,72);
  const blue = hero === 'kirill';
  portraitBackdrop(ctx,hero);
  if (hero === 'mom' || hero === 'dad') {
    drawParent(ctx,hero);
    return;
  }
  const p = blue ? {
    outline:'#1e3843',side:'#25426a',body:'#306eaa',light:'#559cd0',edge:'#81bad7',shirt:'#a0bdc3',
    hair:'#63402a',hairLight:'#8b5b39',hairDark:'#493124',skin:'#e0ad7d',glow:'#f3c593',shade:'#bb8058'
  } : {
    outline:'#463b35',side:'#87472c',body:'#c56b36',light:'#ea964e',edge:'#ffc06a',shirt:'#d8b681',
    hair:'#794428',hairLight:'#a66737',hairDark:'#513724',skin:'#e2a87c',glow:'#f6c696',shade:'#c4865e'
  };
  const r = (c,x,y,w,h)=>box(ctx,c,x,y,w,h);
  const poly = (c,points)=>shape(ctx,c,points);
  // A three-quarter view, with a jacket collar, separate sleeves and a cube-shaped head.
  poly(p.outline,[[18,72],[18,57],[27,49],[40,46],[61,45],[76,50],[83,57],[83,72]]);
  poly(p.side,[[20,58],[30,52],[64,48],[80,56],[80,72],[20,72]]);
  poly(p.body,[[31,55],[42,49],[61,48],[70,53],[68,72],[29,72]]);
  poly(p.light,[[21,56],[31,50],[39,48],[42,52],[33,57],[25,61],[21,61]]);
  poly(p.body,[[20,59],[27,56],[28,65],[20,68]]);
  poly(p.side,[[29,58],[33,55],[33,72],[27,72]]);
  poly(p.light,[[63,50],[69,49],[77,52],[72,55],[66,55]]);
  poly(p.body,[[72,55],[78,54],[81,57],[81,66],[72,68]]);
  r(p.light,22,62,4,2);
  r(p.edge,73,60,5,2);
  poly(p.skin,[[21,69],[27,66],[27,72],[21,72]]);
  poly(p.shade,[[73,69],[81,66],[81,72],[73,72]]);
  poly(p.shirt,[[40,51],[54,51],[51,72],[42,72]]);
  poly(p.light,[[36,51],[43,48],[46,54],[42,57]]);
  poly(p.side,[[48,54],[59,47],[63,49],[54,58]]);
  r(p.edge,37,60,2,10);
  r(p.side,57,61,8,5);
  r(p.light,57,61,8,2);
  r(p.shade,41,42,12,9);
  r(p.skin,41,48,9,3);
  poly(p.outline,[[28,14],[47,6],[59,7],[71,13],[71,37],[63,45],[53,50],[29,47]]);
  // Plane of the face and shadowed side with an inset ear.
  poly(p.shade,[[54,20],[69,14],[69,37],[55,46],[51,42]]);
  poly(p.skin,[[30,18],[55,21],[55,46],[52,48],[30,45]]);
  poly(p.glow,[[31,23],[50,25],[50,39],[37,39],[37,43],[31,42]]);
  poly(p.hair,[[29,15],[47,8],[58,8],[70,13],[54,23],[29,20]]);
  poly(p.hairLight,[[31,15],[49,9],[57,10],[43,16],[43,18]]);
  poly(p.hairDark,[[54,21],[69,14],[69,29],[63,33],[62,25],[58,28],[58,32],[54,32]]);
  poly(p.hair,[[29,16],[55,20],[55,29],[49,28],[49,24],[43,24],[42,27],[38,27],[38,23],[30,22]]);
  r(p.hairLight,32,17,7,2);
  r(p.hairLight,43,19,6,2);
  r(p.hairDark,31,22,5,2);
  if (blue) {
    poly(p.hair,[[32,18],[27,17],[27,14],[30,14],[30,11],[41,11],[48,8],[57,8],[52,12]]);
    r(p.hairLight,31,12,7,2);
  } else {
    poly(p.hair,[[31,17],[30,10],[34,11],[34,7],[38,9],[41,6],[48,9],[57,7],[56,11],[45,15]]);
    r(p.hairLight,36,10,4,2);
    r(p.hairLight,46,10,6,1);
  }
  poly(p.skin,[[60,32],[65,29],[65,36],[60,39]]);
  r(p.shade,61,33,2,3);
  if (blue) {
    // A knotted blue running band crosses the front and wraps around the side.
    poly('#4d91bd',[[29,21],[55,24],[55,27],[29,24]]);
    poly('#315e87',[[55,24],[69,18],[69,21],[55,27]]);
    r('#96c7d3',31,22,8,1);
    poly('#437da6',[[68,19],[72,18],[76,20],[72,22],[69,21]]);
    poly('#315e87',[[69,21],[72,21],[74,25],[79,26],[75,28],[71,26]]);
    r(p.hair,31,28,6,2);
    r(p.hair,44,29,7,2);
  } else {
    // Maxim has a thick fringe and arched brows.
    poly(p.hair,[[29,19],[39,20],[38,24],[34,24],[34,27],[31,27],[31,24],[29,24]]);
    r(p.hairDark,31,28,4,2);
    r(p.hairDark,35,29,3,2);
    r(p.hairDark,44,29,4,2);
    r(p.hairDark,48,28,3,2);
  }
  r('#fff1d0',31,31,6,4);
  r('#fff1d0',45,32,6,4);
  r(p.outline,33,31,3,4);
  r(p.outline,46,32,3,4);
  r('#fff7dd',33,31,1,1);
  r('#fff7dd',46,32,1,1);
  r(p.shade,39,36,4,2);
  r(p.glow,39,35,3,2);
  r(p.shade,35,40,3,1);
  if (blue) {
    r('#87553e',38,41,7,2);
    r('#fff0d3',39,41,5,1);
  } else {
    r('#955838',37,41,8,1);
    r('#955838',44,40,3,1);
    r('#c18a63',32,38,1,1);
    r('#c18a63',34,37,1,1);
    r('#c18a63',49,39,2,1);
    // A raised, leather-lined block glove belongs to the melee hero.
    poly(p.outline,[[16,58],[19,54],[20,47],[24,44],[34,45],[38,48],[38,55],[36,59],[31,65],[20,64]]);
    poly('#855330',[[18,58],[22,52],[36,53],[36,58],[30,63],[20,62]]);
    poly('#ac6733',[[21,48],[25,45],[34,46],[37,49],[36,55],[31,58],[20,55]]);
    poly('#e5a45d',[[21,48],[25,45],[34,46],[36,48],[32,51]]);
    poly('#c8874d',[[21,49],[32,51],[32,56],[21,54]]);
    r('#efbc79',23,49,2,3);
    r('#ae713f',27,50,1,4);
    r('#dac09a',20,57,10,2);
    r('#f6d39d',22,57,3,1);
    r('#4b4941',23,59,4,2);
  }
  r(p.glow,37,44,7,1);
}

const spritePixels = {
  ...storeMonsterPixels,
  guardian: [
    '........54......','...45...44..54..','...44qqqqqq445..','....q313331q4...',
    '.544q1131112q...','....q1666612q..2','..qqq6677611qq12','..q2q6677612q13q',
    '.54qq1111112qq2.','....q1211212q.1.','...4q222222q....','..45.qqqqqq44...',
    '....44..44..54..','....5...54......','................','................'
  ],
  elder_guardian: [
    '..8..98...98...8','..98.89...89..89','...9qqqqqqqqq89.','.88q9IIBB9BB8q..',
    '..9qI9IBBBB98q..','qqqqB666666B8q.8','q89q666776698q98','q98q6667766B8q9q',
    'qq9qBBB66BBB8q9q','.9.qBII9B9B98q..','..9qBB98B9898q..','.899q8888888q9..',
    '...9.qqqqqqq.89.','..89.89...98..8.','.....8.....9....','................'
  ],
  drowned: [
    '....qqqqqqqq....','...q2h133311q...','...q1g113312q...','...q16611662q...',
    '...q13111112q..3','...qg1122212q.333','....qg11112q..333','..qqqlggvllqq..3',
    '.q12qtgvvllq12q3','.q2gqtvvgllq22q3','.qqqqvlgglvqqqq3','....qlllvlvq...3',
    '....q12qq21q...3','....q12qq22q....','...q222qq222q...','...qqqqqqqqqq...'
  ],
  creeper: [
    '    qqqqqqqq    ','   qhhhhgghhq   ','   qghggghhgq   ','   qghoogoogq   ',
    '   qggoogoogq   ','   qgggooggdq   ','   qhgooooddq   ','   qggooododq   ',
    '    qgghggdq    ','     qghgdq     ','     qgghdq     ','     qdgddq     ',
    '   qqdgggddqq   ','   qhggqqghgq   ','   qdgdqqggdq   ','   qqqq  qqqq   '
  ],
  zombie: [
    '     qqqqqqq    ','    qhhggggdq   ','    qhgggghdq   ','    qggoogoqq   ',
    '    qhggggdgq   ','    qggdooqq    ','     qggddq     ','   qqttttttqq   ',
    '  qgghqvttvhgq  ','  qggdqvvvdggq  ','  qddqqvvvqddq  ','   qqqtttvqqq   ',
    '     qlllldq    ','     qllqllq    ','    qdddqdddq   ','    qqqqqqqqq   '
  ],
  spider: [
    '                ','       qqqq     ','      qpaapq    ','   qqqaaapaqqq  ',
    '  qpbqaaaaaqbpq ','  qpqqppaapqqpq ',' qpbqpppppppqbpq',' qpqqpappappqqpq',
    ' qb qpwrrwrpq bq','qq  qbrrprrpq qq','   qppbbppbppq  ','  qpbqpbbbpqbpq ',
    ' qpqq qbqbq qqpq',' qpq   q q   qpq',' qq           qq','                '
  ],
  skeleton: [
    '     qqqqqq     ','    qiiiBBBiq   ','    qiIIIiIBq   ','    qiooiooBq   ',
    '    qBIIoIiBq   ','     qioiiBq    ','      qqBqq     ','    qIIBiBIqq   ',
    '   qi qBBiq iBq ','   qB qiiiq qiq ','   qB qBBiq qiq ','   qq qBBiq  qq ',
    '      qqqqq     ','     qIBqIBq    ','     qiBqiBq    ','     qqqqqqq    '
  ],
  slime: [
    '                ','                ','                ','      qqqqq     ',
    '   qqGLLLGGuqq  ','  qGGGLLLLGGuuq ',' qLLLLGGGGGGuuq ',' qLLGGuuGGGGuuq ',
    ' qLGGxxGGxxGGUq ',' qLGGxxGGxxGGUq ',' qLGGGGxGGGGGUq ',' qGGGGGGGGGuGUq ',
    ' qGuuGGuuuuuuuUq','  qUUuuuuuuUUUq ','   qqqqqqqqqqq  ','                '
  ],
  mom: [
    '     qqqqqq qq  ','    qhllhhqhlhq ','   qhllhhhhdhhq ','   qhhhffhhhdq  ',
    '   qhfffffhddq  ','   qffowfofhkq  ','   qhffffffklq  ','    qfkffkfhdq  ',
    '   qqqfffqqqq   ','  qjjjttttjjjq  ','  qjjjjtjsjsjq  ','  qffqjjtsqffq  ',
    '   qqqjjjsqqq   ','     qnnnnq     ','    qnnqqnnq    ','    qqqqqqqq    '
  ],
  dad: [
    '     qqqqqq     ','    qlhhhhhdq   ','   qlhhhhhdhq   ','   qhlhhhhhhdq  ',
    '   qfffkfffldq  ','   qoowoooowoq  ','   qoffoffofkq  ','   qkhdffdhkq   ',
    '   qqhhwwhdqq   ','  qjjjttttjjjq  ','  qjjjttjsjjtq  ','  qffqjtjsqffq  ',
    '   qqqjjjsqqq   ','     qnnnnq     ','    qnnqqnnq    ','    qqqqqqqq    '
  ],
  hero: [
    '     qqqqqq     ','    qhhhhhhq    ','   qhhllhhhdq   ','   qhhlhhhhhq   ',
    '   qfhhffhhfq   ','   qffowfoffq   ','   qfffffffkq   ','    qfkffkfqq   ',
    '   qqqfffqqqq   ','  qjjtkktjtjjq  ','  qjjjttjjsjtq  ','  qffqjjjsqffq  ',
    '   qqqjjjsqqq   ','     qnnnnq     ','    qnnqqnnq    ','    qqqqqqqq    '
  ]
};

const monsterColors = {
  ...storeMonsterColors,
  1:'#41a89e', 2:'#387579', 3:'#82d9c2', 4:'#dc7f43', 5:'#ffc96b',
  6:'#faf1c9', 7:'#c24b46', 8:'#766d61', 9:'#c5b597',
  q:'#13292b', h:'#a7d471', g:'#73ae55', d:'#477649', o:'#243c36', t:'#66b9b1',
  i:'#c7d2cf', I:'#f2f0df', B:'#95a5a9', G:'#6bcd82', L:'#bcf6a2',
  u:'#4daa73', U:'#3e8867', x:'#376d56',
  v:'#358982', l:'#5e6490', p:'#63505d', b:'#352f42', a:'#846975', r:'#e77745', w:'#ffaf65'
};

const creeperFlash = { q: '#485052', h: '#fff9cc', g: '#fff3af', d: '#eddfa3', o: '#807968' };

const baseHeroColors = {
  q:'#232d36', h:'#875135', l:'#b77c46', d:'#4e3a30', f:'#eeb789', o:'#293940',
  w:'#fdf1d4', k:'#bc835d', n:'#465467'
};

const heroColors = {
  kirill: { ...baseHeroColors, h:'#6d482f', j:'#4b91cd', t:'#a5cde4', s:'#336291' },
  maxim: { ...baseHeroColors, j:'#e89345', t:'#ffd78c', s:'#b66039' },
  mom: { ...baseHeroColors, h:'#75453b', l:'#a46951', j:'#aa81ca', t:'#e6c5ef', s:'#765b9d' },
  dad: { ...baseHeroColors, h:'#624537', l:'#92745f', j:'#e3b24c', t:'#ed7761', s:'#a46f36' }
};

function sprite(ctx, name, colors, x, y, facingLeft=false) {
  ctx.save();
  ctx.translate(x+(facingLeft ? 16 : 0), y);
  if (facingLeft) ctx.scale(-1,1);
  spritePixels[name].forEach((row,dy) => {
    for (let dx=0; dx<row.length; dx++) {
      const c = colors[row[dx]];
      if (c) box(ctx,c,dx,dy,1,1);
    }
  });
  ctx.restore();
}

export function drawMonsterPortrait(canvas, type) {
  const ctx = surface(canvas,24,24);
  ctx.clearRect(0,0,24,24);
  box(ctx,'#203533',4,20,16,2);
  sprite(ctx,type,monsterColors,4,5);
}

const TILE = 20;
const backgrounds = new WeakMap();

function floorTile(ctx, x, y, roll) {
  const base = ['#21312f','#223331','#233431','#243431'];
  box(ctx,base[roll%4],x,y,TILE,TILE);
  if (roll%3) {
    box(ctx,'#2d3d37',x+3+roll%12,y+3+roll%9,2,1);
    box(ctx,'#1e2d2c',x+6+roll%10,y+8+roll%8,1,1);
  }
  if (roll%17===0) {
    box(ctx,'#35493c',x+3,y+14,1,3);
    box(ctx,'#40503d',x+5,y+13,1,2);
  }
}

function wallTile(ctx, state, col, row, variation) {
  const x = col*TILE, y=row*TILE;
  const stone = (dx,dy)=>state.map[row+dy]?.[col+dx]==='#';
  const above = stone(0,-1), below=stone(0,1), left=stone(-1,0), right=stone(1,0);
  const rand = randomSequence(617*variation + 13*col + row);
  const inset = left ? 0 : 1;
  const side = right ? 0 : 1;
  const width = TILE-inset-side;
  const base = ['#657768','#6b7b69','#697968','#64776a'];
  box(ctx,'#192b2b',x,y,TILE,TILE);
  box(ctx,base[variation%4],x+inset,y+1,width,TILE-2);
  // Blocks have staggered mortar seams and chipped facets.
  const joint = 6 + ((row + col)%3)*3;
  box(ctx,'#556b60',x+joint,y+1,1,7);
  box(ctx,'#52675c',x+inset,y+8,width,1);
  box(ctx,'#7c8c76',x+inset+1,y+9,width-2,1);
  box(ctx,'#5a6e61',x+TILE-2,y+10,1,9);
  box(ctx,'#84917b',x+inset+2,y+1,4+variation%5,1);
  for (let i=0;i<4;i++) {
    const px=2+Math.floor(rand()*15), py=2+Math.floor(rand()*13);
    box(ctx,i%2 ? '#788972' : '#5d7264',x+px,y+py,1+Math.floor(rand()*3),1);
  }
  if (!below) {
    box(ctx,'#384e49',x+inset,y+13,width,5);
    box(ctx,'#4b6157',x+inset+1,y+13,width-2,1);
    box(ctx,'#273f3d',x+inset,y+18,width,1);
    box(ctx,'#2e4641',x+joint+3,y+14,1,4);
  }
  if (!right) box(ctx,'#41594f',x+TILE-2,y+1,1,below ? TILE-2 : 12);
  if (!left) box(ctx,'#81917a',x+1,y+2,1,below ? TILE-3 : 10);
  // Moss follows exposed edges and continues over neighboring blocks.
  if (!above || variation%6===0) {
    const depth = !above ? 3 : 2;
    box(ctx,'#647c4b',x+inset,y+1,width,depth);
    box(ctx,'#94a962',x+inset+2,y+1,5+variation%8,1);
    box(ctx,'#536f45',x+3+variation%10,y+2,3,depth+1);
    if (variation%3===0) {
      box(ctx,'#637e4c',x+5,y+3,2,5);
      box(ctx,'#849951',x+7,y+5,2,1);
    }
  }
  if (above && below) box(ctx,base[variation%4],x+inset,y,width,1);
  if (below) box(ctx,'#566c5d',x+inset,y+19,width,1);
  if (above && below && left && right && variation%7===0) {
    box(ctx,'#4e665b',x+6,y+4,9,9);
    box(ctx,'#86977b',x+7,y+4,7,1);
    box(ctx,'#718573',x+8,y+6,5,5);
    box(ctx,'#556c60',x+10,y+8,2,2);
  }
}

function background(canvas,state) {
  const previous = backgrounds.get(canvas);
  if (previous?.map === state.map) return previous.canvas;
  const layer = document.createElement('canvas');
  const ctx = surface(layer,state.width*TILE,state.height*TILE);
  const rand = randomSequence(12937);
  const theme = levelArt[state.levelId];
  for (let row=0;row<state.height;row++) {
    for (let col=0;col<state.width;col++) {
      const variation = Math.floor(rand()*1031);
      if (theme) {
        theme.tile(ctx,state.map,col,row,TILE,variation);
      } else if (state.map[row][col] === '#') {
        wallTile(ctx,state,col,row,variation);
      } else {
        floorTile(ctx,col*TILE,row*TILE,variation);
        if (state.map[row-1]?.[col]==='#') box(ctx,'#1a2a29',col*TILE,row*TILE,TILE,2);
      }
    }
  }
  for (const attraction of state.decorations) theme.fixture(ctx,attraction,TILE);
  if (state.ride) drawRideAccess(ctx, state.ride, TILE);
  backgrounds.set(canvas,{canvas:layer,map:state.map});
  return layer;
}

function emerald(ctx,x,y) {
  box(ctx,'#192b28',x-2,y+3,5,2);
  box(ctx,'#21694e',x-3,y-2,7,5);
  box(ctx,'#30815e',x-2,y-3,5,7);
  box(ctx,'#61c78c',x-2,y-2,5,4);
  box(ctx,'#a9edac',x-1,y-3,3,2);
  box(ctx,'#c7f6c9',x-2,y-1,2,2);
  box(ctx,'#43aa77',x+1,y-1,2,3);
  box(ctx,'#499363',x-1,y+2,3,1);
}

function actorPos(actor) {
  return [Math.round((actor.x+0.5)*TILE), Math.round((actor.y+0.5)*TILE)];
}

const booLetters = [
  '111 101 1', '100 101 1', '110 011 1', '101 001 0', '111 110 1'
];

function drawBoo(ctx, x, y) {
  // The balloon stays clear of the player and within the board at its edges.
  const left = Math.min(x + 2, ctx.canvas.width - 28);
  const top = y < 27 ? y + 9 : y - 25;
  box(ctx,'#382c3a', left, top, 25, 16);
  box(ctx,'#ffe9b2', left + 1, top + 1, 23, 13);
  box(ctx,'#ffe9b2', left + 3, y < 27 ? top - 2 : top + 14, 3, 3);
  booLetters.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] === '1') box(ctx,'#55374a',left + 3 + dx * 2,top + 2 + dy * 2,2,2);
    }
  });
}

export function drawBoard(canvas,state) {
  const ctx = surface(canvas,state.width*TILE,state.height*TILE);
  ctx.drawImage(background(canvas,state),0,0);
  const animateRide = levelArt[state.levelId]?.animate;
  if (animateRide) {
    for (const ride of state.decorations) animateRide(ctx,ride,TILE,state.time);
  }
  drawMonsterEffects(ctx,state);
  for (const index of state.gems) {
    emerald(ctx,(index%state.width+0.5)*TILE,(Math.floor(index/state.width)+0.5)*TILE);
  }
  for (const monster of state.monsters) {
    const [x,y]=actorPos(monster);
    box(ctx,'#172927',x-6,y+6,13,3);
    const jumpPhase = state.time % .9;
    const hop = monster.type === 'slime' && !monster.stun && jumpPhase < .55
      ? Math.round(3 * Math.sin(Math.PI * jumpPhase / .55)) : 0;
    sprite(ctx,monster.type,monsterColors,x-8,y-8-hop,monster.dir==='left');
    if (monster.type === 'creeper' && monster.windup > 0) {
      // Two warm pulses on the preparing creeper leave the surrounding board steady.
      ctx.save();
      ctx.globalAlpha = .15 + .65 * Math.sin(Math.PI * 2 * monster.windup) ** 2;
      sprite(ctx,'creeper',creeperFlash,x-8,y-8,monster.dir==='left');
      ctx.restore();
    }
    showCharge(ctx,monster,x,y);
    if (state.fear > 0) {
      box(ctx,'#8de5f5',x+6,y-10,2,3);
      box(ctx,'#d3f8ff',x+6,y-10,1,1);
      box(ctx,'#8de5f5',x+9,y-8,1,2);
    }
    if (monster.stun > 0) {
      box(ctx,'#ffed9a',x-5,y-9,3,1);
      box(ctx,'#ffed9a',x-4,y-10,1,3);
      box(ctx,'#ffc867',x+3,y-10,2,2);
    }
  }
  const [x,y] = state.rideRemaining > 0 ? riderPosition(state,TILE) : actorPos(state.player);
  box(ctx,'#192d29',x-6,y+6,13,3);
  if (state.boost > 0) {
    const vector = {up:[0,1],down:[0,-1],left:[1,0],right:[-1,0]}[state.player.dir] || [-1,0];
    for (let n=0;n<3;n++) {
      const step = 8+n*2, spread=n%2===0 ? -3 : 3;
      const sx=x+vector[0]*step+vector[1]*spread, sy=y+vector[1]*step+vector[0]*spread;
      box(ctx,n===0 ? '#a7ecdf' : '#70bdae',sx,sy,vector[0] ? 3 : 1,vector[1] ? 3 : 1);
    }
  }
  ctx.save();
  if (state.invulnerable>0 && Math.floor(state.time*8)%2) ctx.globalAlpha=0.55;
  if (state.invisible > 0) ctx.globalAlpha = 0.42;
  const model = state.hero === 'mom' || state.hero === 'dad' ? state.hero : 'hero';
  sprite(ctx,model,heroColors[state.hero],x-8,y-8,state.player.dir==='left');
  ctx.restore();
  if (state.invisible > 0) {
    const drift = Math.floor(state.time * 5) % 3;
    for (const [dx,dy] of [[-9,-5],[8,1],[-5,9],[5,-9]]) {
      box(ctx,'#d4b7fc',x+dx,y+dy-drift,2,1);
    }
  }
  if (state.slow > 0) showSlow(ctx,x,y,state.time);
  if (state.fear > 0) drawBoo(ctx,x,y);
  if (state.attack>0) {
    const points = [[-9,-6],[-10,0],[-8,6],[-3,9],[4,9],[9,5],[10,-1],[8,-6]];
    for (const [dx,dy] of points) box(ctx,'#ffe095',x+dx,y+dy,3,2);
  }
}
