const defaultGame = '/block-playroom/';
const games = new Set(['block-maze', 'block-jump', 'block-dash', 'block-playroom']);
const origin = 'https://polomodov.github.io';

// Static games with no third-party code: everything is served from this host.
const security = {
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "media-src 'self' data: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function redirect(url, status) {
  return new Response(null, { status, headers: { Location: url.href, ...security } });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    if (url.pathname === '/') {
      url.protocol = 'https:';
      url.pathname = defaultGame;
      return redirect(url, 302);
    }
    const section = url.pathname.split('/')[1];
    if (!games.has(section)) return new Response(null, { status: 404 });
    if (url.pathname === '/' + section) {
      url.protocol = 'https:';
      url.pathname += '/';
      return redirect(url, 308);
    }
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return redirect(url, 308);
    }

    // Only the static game's cache validators and range requests belong at the origin.
    const headers = new Headers();
    for (const name of ['If-None-Match', 'If-Modified-Since', 'Range', 'If-Range']) {
      if (request.headers.has(name)) headers.set(name, request.headers.get(name));
    }
    // Pages answers a folder without a trailing slash with a redirect. Following it
    // here would serve the page at the wrong address and break its relative links,
    // so pass redirects to the browser, keeping the visitor on this host.
    const upstream = await fetch(origin + url.pathname + url.search, { method: request.method, headers, redirect: 'manual' });
    const response = new Response(upstream.body, upstream);
    const location = upstream.headers.get('Location');
    if (location) {
      const target = new URL(location, origin + url.pathname);
      if (target.origin === origin || target.origin === url.origin.replace('http:', 'https:')) {
        response.headers.set('Location', 'https://' + url.host + target.pathname + target.search + target.hash);
      }
    }
    for (const [name, value] of Object.entries(security)) response.headers.set(name, value);
    return response;
  },
};
