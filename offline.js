const status = document.querySelector('#offline-status');
const retry = document.querySelector('#offline-retry');
const install = document.querySelector('#install-game');
let promptEvent, busy = false;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptEvent=e; install.hidden=false; });
window.addEventListener('appinstalled', () => { install.hidden=true; promptEvent=null; });
install.addEventListener('click', async () => {
  const pending=promptEvent;
  if (!pending) return;
  await pending.prompt();
  await pending.userChoice;
  install.hidden=true; promptEvent=null;
});
function confirmFiles(worker) {
  return new Promise((resolve,reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('cache unavailable')); }, 90000);
    channel.port1.onmessage = e => {
      clearTimeout(timer);channel.port1.close();
      if (e.data?.ready) resolve(); else reject(new Error('download failed'));
    };
    worker.postMessage('offline-status',[channel.port2]);
  });
}
function activated(worker) {
  return new Promise((resolve,reject) => {
    function state() {
      if (worker.state === 'activated') { worker.removeEventListener('statechange',state); resolve(worker); }
      if (worker.state === 'redundant') { worker.removeEventListener('statechange',state); reject(new Error('install failed')); }
    }
    worker.addEventListener('statechange',state); state();
  });
}
// Ask the browser not to evict saves and the offline copy (Safari clears
// storage of sites that are not on the home screen after a week without visits).
function keepStorage() {
  navigator.storage?.persist?.().catch(() => {});
}
async function prepare() {
  if (busy) return;
  if (!('serviceWorker' in navigator)) {status.textContent='Этот браузер не поддерживает офлайн-режим.'; return;}
  busy=true; retry.hidden=true;
  status.textContent='Загрузка игры для офлайна…';
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', {scope:'./', updateViaCache:'none'});
    // A newer version being installed takes priority over the active one,
    // so "ready" always describes the release that will actually run.
    let pending = reg.installing || reg.waiting;
    if (!pending && !reg.active) { await reg.update(); pending = reg.installing || reg.waiting; }
    const worker = pending ? await activated(pending) : reg.active;
    if (!worker) throw new Error('no worker');
    await confirmFiles(worker);
    status.textContent='Готово к игре офлайн'; status.dataset.ready='true';
    keepStorage();
  } catch {
    delete status.dataset.ready;
    status.textContent='Не удалось подготовить игру. Подключись к интернету и повтори загрузку.';
    retry.hidden=false;
  } finally { busy=false; }
}
retry.addEventListener('click',prepare);
window.addEventListener('online', () => { if (!status.dataset.ready) prepare(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', () => {
  delete status.dataset.ready;
  prepare();
});
prepare();
