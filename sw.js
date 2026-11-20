importScripts('./offline-files.js');
const base = self.registration.scope;
const prefix = 'family-offline:' + new URL(base).pathname + ':';
const cacheName = prefix + OFFLINE_REVISION;
const files = new Map(OFFLINE_FILES.map(([path, integrity]) => [new URL(path,base).href, integrity]));

// Pages opened before an update keep reading the release they were loaded from,
// so a sprite sheet or script fetched mid-game always matches the code already
// running. The page-to-release map lives in Cache Storage, because the browser
// may stop and restart this worker at any time without running activate again.
const routesCache = prefix + 'routes';
const routesKey = base + '__offline-routes';
let routes;
function loadRoutes() {
  routes ??= caches.open(routesCache)
    .then(cache => cache.match(routesKey))
    .then(response => response ? response.json() : {})
    .catch(() => ({}));
  return routes;
}
async function saveRoutes(map) {
  routes = Promise.resolve(map);
  const cache = await caches.open(routesCache);
  await cache.put(routesKey, new Response(JSON.stringify(map), {headers:{'Content-Type':'application/json'}}));
}
// Releases created before this one, oldest first (Cache Storage keeps creation
// order). A newer release may already be installing; it is never touched here.
async function olderReleases() {
  const names = (await caches.keys()).filter(name => name.startsWith(prefix) && name !== routesCache);
  const index = names.indexOf(cacheName);
  return index < 0 ? [] : names.slice(0, index);
}
// Forget closed pages and delete every older release no open page still uses.
async function pruneReleases(map) {
  const live = {};
  const found = await Promise.all(Object.keys(map).map(id => self.clients.get(id)));
  for (const client of found) if (client) live[client.id] = map[client.id];
  await saveRoutes(live);
  const used = new Set(Object.values(live));
  const stale = (await olderReleases()).filter(name => !used.has(name));
  await Promise.all(stale.map(name => caches.delete(name)));
}

// addAll is atomic: an interrupted download never advertises a partial game.
function download(cache, urls) {
  return cache.addAll(urls.map(url => new Request(url, {cache:'reload', integrity:files.get(url)})));
}
self.addEventListener('install', event => {
  // Activate as soon as the whole release is stored, so an installed app does not
  // stay on an old version until every window is closed.
  event.waitUntil(caches.open(cacheName).then(cache => download(cache, [...files.keys()])).then(() => self.skipWaiting()));
});
// Pruning is only safe once this release serves pages: before that, the
// previous worker is still active and its pages have no route yet.
let activation = null;
async function pruneWhenActive() {
  await activation;
  if ((self.serviceWorker?.state ?? 'activated') === 'activated') await pruneReleases(await loadRoutes());
}
self.addEventListener('activate', event => {
  event.waitUntil(activation = (async () => {
    const open = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    const older = await olderReleases();
    const map = {...await loadRoutes()};
    // A page without a route was loaded from the newest older release; a page
    // that already has one keeps it through any number of further updates.
    const loadedFrom = older.at(-1);
    if (loadedFrom) for (const client of open) map[client.id] ??= loadedFrom;
    await pruneReleases(map);
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
      await pruneWhenActive();
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
    const release = (await loadRoutes())[event.clientId];
    if (release && await caches.has(release)) {
      const old = await caches.open(release).then(cache => cache.match(url.href));
      if (old) return old;
    }
    const cache = await caches.open(cacheName);
    const cached = await cache.match(url.href);
    if (cached) return cached;
    await download(cache, [url.href]);
    return (await cache.match(url.href)) || Response.error();
  })());
});
