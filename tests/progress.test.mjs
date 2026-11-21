import test from 'node:test';
import assert from 'node:assert/strict';

// Two tabs share one localStorage. Each import of progress.js is a separate tab.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.document = { querySelector: () => null };
let tabs = 0;
const openTab = () => import('../progress.js?tab=' + ++tabs);
const profile = () => JSON.parse([...store.values()][0]);
const snapshot = (level, extra = {}) => ({ version: 1, hero: 'kirill', level, ...extra });

test('an old tab cannot overwrite the round that a newer tab started', async () => {
  store.clear();
  const oldTab = await openTab();
  const newTab = await openTab();
  oldTab.beginArcadeRound();
  oldTab.saveGame(snapshot('temple'));
  newTab.beginArcadeRound();
  newTab.saveGame(snapshot('end'));
  oldTab.saveGame(snapshot('temple', { late: true }));
  assert.equal(newTab.loadSavedGame().level, 'end');
  // Finishing the old round records the result and keeps the newer save.
  oldTab.addResult({ hero: 'kirill', level: 'temple', gems: 3, outcome: 'won' });
  assert.equal(profile().saved.level, 'end');
  assert.equal(profile().results[0].level, 'temple');
  // The newer tab still owns its round and clears the save when it finishes.
  newTab.saveGame(snapshot('end', { step: 2 }));
  assert.equal(profile().saved.step, 2);
  newTab.addResult({ hero: 'kirill', level: 'end', gems: 1, outcome: 'lost' });
  assert.equal(profile().saved, null);
  assert.equal(profile().results.length, 2);
});

test('a tab that never started a round does not write checkpoints', async () => {
  store.clear();
  const tab = await openTab();
  tab.saveGame(snapshot('temple'));
  assert.equal(tab.loadSavedGame(), null);
});

test('damaged history rows are skipped and unreadable data leaves a blank profile', async () => {
  const tab = await openTab();
  store.clear();
  store.set('family-games:' + new URL('../', import.meta.url).pathname + ':progress:1', JSON.stringify({
    saved: null,
    results: [null, { hero: 'kirill', level: 'temple', at: Date.now() }, { hero: 'ghost', level: 'temple', at: 1 },
      { hero: 'mom', level: 'nowhere', at: 1 }, { hero: 'dad', level: 'end', at: 'yesterday' }],
  }));
  tab.beginArcadeRound();
  tab.addResult({ hero: 'dad', level: 'end', gems: 0, outcome: 'won' });
  assert.deepEqual(profile().results.map((r) => r.hero), ['dad', 'kirill']);
  store.set([...store.keys()][0], '{broken');
  assert.equal(tab.loadSavedGame(), null);
});

test('replaying a result with the same id replaces the earlier row and keeps fifty rows', async () => {
  store.clear();
  const tab = await openTab();
  tab.beginArcadeRound();
  for (let i = 0; i < 60; i++) tab.addResult({ hero: 'maxim', level: 'arcade', gems: i, outcome: 'won' });
  assert.equal(profile().results.length, 50);
  tab.addResult({ id: 'run-1', hero: 'maxim', level: 'arcade', gems: 1, outcome: 'over' });
  tab.addResult({ id: 'run-1', hero: 'maxim', level: 'arcade', gems: 9, outcome: 'over' });
  assert.equal(profile().results.filter((r) => r.id === 'run-1').length, 1);
  assert.equal(profile().results[0].gems, 9);
});
