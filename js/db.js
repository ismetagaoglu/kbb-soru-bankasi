/*
 * IndexedDB katmanı. Tüm veriler bu tarayıcıda saklanır.
 * Depolar: questions, attempts, favorites, tests, meta
 */
(function (root) {
  'use strict';

  const NAME = 'kbb-soru-bankasi';
  const VERSION = 1;
  const STORES = ['questions', 'attempts', 'favorites', 'tests', 'meta'];
  let db = null;

  function req(r) {
    return new Promise((resolve, reject) => {
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  function open() {
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in root)) { reject(new Error('Bu tarayıcı IndexedDB desteklemiyor.')); return; }
      const r = indexedDB.open(NAME, VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('questions')) {
          const s = d.createObjectStore('questions', { keyPath: 'id' });
          s.createIndex('hash', 'hash', { unique: false });
        }
        if (!d.objectStoreNames.contains('attempts')) {
          const s = d.createObjectStore('attempts', { keyPath: 'id' });
          s.createIndex('qid', 'qid', { unique: false });
        }
        if (!d.objectStoreNames.contains('favorites')) d.createObjectStore('favorites', { keyPath: 'qid' });
        if (!d.objectStoreNames.contains('tests')) d.createObjectStore('tests', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
      };
      r.onsuccess = () => {
        db = r.result;
        db.onversionchange = () => { db.close(); db = null; };
        resolve(db);
      };
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('Veritabanı başka bir sekmede açık. Diğer sekmeleri kapatıp yenileyin.'));
    });
  }

  // fn(stores) içinde istekleri başlatın; işlem tamamlanınca çözülür.
  function run(names, mode, fn) {
    return open().then(d => new Promise((resolve, reject) => {
      const tx = d.transaction(names, mode);
      const stores = {};
      for (const n of [].concat(names)) stores[n] = tx.objectStore(n);
      let out;
      try { out = fn(stores, tx); } catch (e) { try { tx.abort(); } catch (_) { /* yok say */ } reject(e); return; }
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('İşlem iptal edildi'));
    }));
  }

  const getAll = name => open().then(d => req(d.transaction(name).objectStore(name).getAll()));
  const put = (name, obj) => run(name, 'readwrite', s => { s[name].put(obj); });
  const putMany = (name, arr) => run(name, 'readwrite', s => { for (const o of arr) s[name].put(o); });
  const del = (name, key) => run(name, 'readwrite', s => { s[name].delete(key); });
  const delMany = (name, keys) => run(name, 'readwrite', s => { for (const k of keys) s[name].delete(k); });

  root.DB = { STORES, open, run, getAll, put, putMany, del, delMany };
})(window);
