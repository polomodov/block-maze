importScripts('./offline-files.js');
const base = self.registration.scope;
const prefix = 'family-offline:' + new URL(base).pathname + ':';
const cacheName = prefix + OFFLINE_REVISION;
const files = new Map(OFFLINE_FILES.map(([path, integrity]) => [new URL(path,base).href, integrity]));
// Pages opened before this version activated keep reading the previous release,
// so a sprite sheet or script loaded mid-game always matches the code already running.
let previousCache = null;
let previousClients = new Set();

// addAll is atomic: an interrupted download never advertises a partial game.
function download(cache, urls) {
  return cache.addAll(urls.map(url => new Request(url, {cache:'reload', integrity:files.get(url)})));
}
async function dropPreviousWhenUnused() {
  if (!previousCache) return;
  const open = await Promise.all([...previousClients].map(id => self.clients.get(id)));
  if (open.some(Boolean)) return;
  await caches.delete(previousCache);
  previousCache = null;
  previousClients = new Set();
}
self.addEventListener('install', event => {
  // Activate as soon as the whole release is stored, so an installed app does not
  // stay on an old version until every window is closed.
  event.waitUntil(caches.open(cacheName).then(cache => download(cache, [...files.keys()])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({type:'window'});
    const names = (await caches.keys()).filter(name => name.startsWith(prefix) && name !== cacheName);
    // Keep the newest older release (the one open pages were loaded from).
    previousCache = open.length && names.length ? names.at(-1) : null;
    previousClients = new Set(previousCache ? open.map(client => client.id) : []);
    for (const name of names) if (name !== previousCache) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data !== 'offline-status' || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(cacheName);
      const present = new Set((await cache.keys()).map(req => req.url));
      const missing = [...files.keys()].filter(url => !present.has(url));
      if (missing.length) await download(cache, missing);
      await dropPreviousWhenUnused();
      event.ports[0].postMessage({ready:true, count:files.size, revision:OFFLINE_REVISION});
    } catch {
      // The site may already serve a newer release whose files no longer match this
      // worker's checksums. Ask the browser to fetch that release instead.
      self.registration.update().catch(() => {});
      event.ports[0].postMessage({ready:false});
    }
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  url.search = ''; url.hash = '';
  if (url.href === base) url.pathname += 'index.html';
  if (!files.has(url.href)) return;
  event.respondWith((async () => {
    if (previousCache && previousClients.has(event.clientId)) {
      const old = await caches.open(previousCache).then(cache => cache.match(url.href));
      if (old) return old;
    }
    const cache = await caches.open(cacheName);
    const cached = await cache.match(url.href);
    if (cached) return cached;
    await download(cache, [url.href]);
    return (await cache.match(url.href)) || Response.error();
  })());
});
