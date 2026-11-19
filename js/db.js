/* IndexedDB wrapper. Loaded both from the main thread (script tag) and
   from the service worker (importScripts) so it must stay a classic script
   (no ES module import/export). */

const GolfDB = (function () {
  const DB_NAME = 'golf-score-db';
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('games')) {
          db.createObjectStore('games', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('pendingShare')) {
          db.createObjectStore('pendingShare', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode) {
    return openDb().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAllGames() {
    const store = await tx('games', 'readonly');
    return reqToPromise(store.getAll());
  }

  async function addGame(game) {
    const store = await tx('games', 'readwrite');
    return reqToPromise(store.add(game));
  }

  async function updateGame(game) {
    const store = await tx('games', 'readwrite');
    return reqToPromise(store.put(game));
  }

  async function deleteGame(id) {
    const store = await tx('games', 'readwrite');
    return reqToPromise(store.delete(id));
  }

  async function countGames() {
    const store = await tx('games', 'readonly');
    return reqToPromise(store.count());
  }

  async function seedIfEmpty(seedGames) {
    const count = await countGames();
    if (count > 0) return;
    const store = await tx('games', 'readwrite');
    for (const g of seedGames) {
      store.add(g);
    }
  }

  async function getSetting(key, defaultValue) {
    const store = await tx('settings', 'readonly');
    const row = await reqToPromise(store.get(key));
    return row ? row.value : defaultValue;
  }

  async function setSetting(key, value) {
    const store = await tx('settings', 'readwrite');
    return reqToPromise(store.put({ key, value }));
  }

  async function putPendingShare(blob) {
    const store = await tx('pendingShare', 'readwrite');
    return reqToPromise(store.put({ id: 'latest', blob, createdAt: Date.now() }));
  }

  async function getPendingShare() {
    const store = await tx('pendingShare', 'readonly');
    return reqToPromise(store.get('latest'));
  }

  async function clearPendingShare() {
    const store = await tx('pendingShare', 'readwrite');
    return reqToPromise(store.delete('latest'));
  }

  return {
    getAllGames,
    addGame,
    updateGame,
    deleteGame,
    countGames,
    seedIfEmpty,
    getSetting,
    setSetting,
    putPendingShare,
    getPendingShare,
    clearPendingShare,
  };
})();

if (typeof self !== 'undefined') {
  self.GolfDB = GolfDB;
}
