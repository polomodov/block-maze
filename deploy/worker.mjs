const defaultGame = '/block-maze/';
const games = new Set(['block-maze', 'block-jump', 'block-dash']);
const origin = 'https://polomodov.github.io';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    if (url.pathname === '/') {
      url.protocol = 'https:';
      url.pathname = defaultGame;
      return Response.redirect(url, 302);
    }
    const section = url.pathname.split('/')[1];
    if (!games.has(section)) return new Response(null, { status: 404 });
    if (url.pathname === '/' + section) {
      url.protocol = 'https:';
      url.pathname += '/';
      return Response.redirect(url, 308);
    }
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url, 308);
    }

    // Only the static game's cache validators and range requests belong at the origin.
    const headers = new Headers();
    for (const name of ['If-None-Match', 'If-Modified-Since', 'Range', 'If-Range']) {
      if (request.headers.has(name)) headers.set(name, request.headers.get(name));
    }
    return fetch(origin + url.pathname + url.search, { method: request.method, headers });
  },
};
