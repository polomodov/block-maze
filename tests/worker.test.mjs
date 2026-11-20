import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../deploy/worker.mjs';

const host = 'https://games.polomodov.tech';
async function call(path, upstream = () => new Response('ok', { status: 200 }), init = {}) {
  const seen = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    seen.push({ url, options });
    return upstream(url, options);
  };
  try {
    return { response: await worker.fetch(new Request(host + path, init)), seen };
  } finally {
    globalThis.fetch = original;
  }
}

test('the domain root opens the family playroom', async () => {
  const { response, seen } = await call('/');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), host + '/block-playroom/');
  assert.equal(seen.length, 0);
});

test('unknown sections and unsafe methods never reach GitHub Pages', async () => {
  assert.equal((await call('/other-repo/')).response.status, 404);
  const post = await call('/block-maze/', undefined, { method: 'POST' });
  assert.equal(post.response.status, 405);
  assert.equal(post.seen.length, 0);
});

test('a section without its slash is redirected on this host', async () => {
  const { response } = await call('/block-jump?level=end');
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('Location'), host + '/block-jump/?level=end');
});

test('Pages redirects for nested folders stay on the games domain', async () => {
  const { response, seen } = await call('/block-playroom/games/block-maze', () =>
    new Response(null, { status: 301, headers: { Location: 'https://polomodov.github.io/block-playroom/games/block-maze/' } }));
  assert.equal(seen[0].options.redirect, 'manual');
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('Location'), host + '/block-playroom/games/block-maze/');
});

test('responses keep only safe request headers and gain security headers', async () => {
  const { response, seen } = await call('/block-dash/game.js?v=1', undefined, {
    headers: { 'If-None-Match': '"abc"', Cookie: 'secret=1', 'User-Agent': 'test' },
  });
  assert.equal(seen[0].url, 'https://polomodov.github.io/block-dash/game.js?v=1');
  assert.equal(seen[0].options.headers.get('If-None-Match'), '"abc"');
  assert.equal(seen[0].options.headers.get('Cookie'), null);
  assert.equal(await response.text(), 'ok');
  assert.match(response.headers.get('Content-Security-Policy'), /default-src 'self'/);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(response.headers.get('Strict-Transport-Security'), /max-age=\d+/);
});
