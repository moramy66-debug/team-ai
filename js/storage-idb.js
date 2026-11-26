(function (global) {
  'use strict';
  const DB_NAME = 'teamai_db';
  const DB_VERSION = 1;
  const STORES = ['codes', 'history', 'checkpoints', 'meta'];
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function getItem(storeName, key, fallback = null) {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : fallback);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      return fallback;
    }
  }

  async function setItem(storeName, key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function migrateFromLocalStorage() {
    const migrated = await getItem('meta', 'ls_migrated_v1', false);
    if (migrated) return false;
    const mappings = [
      { lsKey: 'teamai.codes', store: 'codes', key: 'items' },
      { lsKey: 'teamai.hist', store: 'history', key: 'items' },
      { lsKey: 'RCK.steps', store: 'checkpoints', key: 'steps' }
    ];
    for (const { lsKey, store, key } of mappings) {
      const raw = global.localStorage?.getItem(lsKey);
      if (!raw) continue;
      try {
        await setItem(store, key, JSON.parse(raw));
        global.localStorage.removeItem(lsKey);
      } catch (err) {}
    }
    await setItem('meta', 'ls_migrated_v1', true);
    return true;
  }

  global.TeamAIStorage = {
    openDB, getItem, setItem, migrateFromLocalStorage,
    getCodes: () => getItem('codes', 'items', []),
    saveCodes: (items) => setItem('codes', 'items', items),
    getHistory: () => getItem('history', 'items', []),
    saveHistory: (items) => setItem('history', 'items', items),
    getCheckpoints: () => getItem('checkpoints', 'steps', null),
    saveCheckpoints: (steps) => setItem('checkpoints', 'steps', steps)
  };
})(typeof window !== 'undefined' ? window : globalThis);
