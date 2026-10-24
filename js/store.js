/*
 * Uygulama durumu ve veri işlemleri (IndexedDB üstünde).
 */
(function (root) {
  'use strict';
  const QP = root.QP, DB = root.DB;
  const LETTERS = QP.LETTERS;

  const S = {
    questions: new Map(),
    attempts: [],
    attemptIds: new Set(),
    favorites: new Map(),
    tests: new Map(),
    meta: {},
    progress: new Map(),
    _sorted: null,
    _search: new Map()
  };

  function uid(prefix) {
    let r = '';
    if (root.crypto && root.crypto.getRandomValues) {
      r = Array.from(root.crypto.getRandomValues(new Uint32Array(2))).map(n => n.toString(36)).join('');
    } else {
      r = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    }
    return (prefix || '') + Date.now().toString(36) + r;
  }

  const clone = o => JSON.parse(JSON.stringify(o));

  async function load() {
    await DB.open();
    const [qs, at, fv, ts, mt] = await Promise.all(DB.STORES.map(DB.getAll));
    S.questions = new Map(qs.map(q => [q.id, q]));
    S.attempts = at.sort((a, b) => a.at - b.at);
    S.attemptIds = new Set(at.map(a => a.id));
    S.favorites = new Map(fv.map(f => [f.qid, f]));
    S.tests = new Map(ts.map(t => [t.id, t]));
    S.meta = {};
    for (const m of mt) S.meta[m.key] = m.value;
    invalidate();
    recompute();
  }

  function invalidate() { S._sorted = null; S._search.clear(); }

  function recompute() {
    S.progress = new Map();
    for (const a of S.attempts) addProgress(a);
  }

  function addProgress(a) {
    let p = S.progress.get(a.qid);
    if (!p) { p = { n: 0, correct: 0, last: null, lastAt: 0 }; S.progress.set(a.qid, p); }
    p.n++;
    if (a.correct) p.correct++;
    if (a.at >= p.lastAt) { p.last = a.correct; p.lastAt = a.at; }
  }

  function setMeta(key, value) { S.meta[key] = value; return DB.put('meta', { key, value }); }
  function touch() { return setMeta('lastChangeAt', Date.now()); }

  function sorted() {
    if (!S._sorted) S._sorted = [...S.questions.values()].sort((a, b) => (a.order || 0) - (b.order || 0));
    return S._sorted;
  }

  // --- Arama / filtre ---
  function fold(s) {
    return String(s || '')
      .replace(/İ/g, 'i').replace(/I/g, 'ı')
      .toLocaleLowerCase('tr')
      .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
      .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[*_`#>|]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  function searchText(q) {
    let s = S._search.get(q.id);
    if (s === undefined) {
      s = fold([q.stem, ...LETTERS.map(l => q.options[l]), q.explanation, q.topic, (q.related || []).join(' '), q.type,
        (q.sources || []).map(x => x.raw || x.name).join(' ')].join(' '));
      S._search.set(q.id, s);
    }
    return s;
  }

  const sourceNames = q => (q.sources && q.sources.length ? q.sources.map(s => s.name) : ['']);
  const inTopic = (topic, key) => topic === key || topic.startsWith(key + ' > ');

  function emptyCrit() { return { pool: 'all', topics: [], sources: [], diffs: [], types: [], search: '' }; }

  function filter(c) {
    const srcSet = new Set(c.sources || []);
    const tokens = c.search ? fold(c.search).trim().split(' ').filter(Boolean) : [];
    return sorted().filter(q => {
      const p = S.progress.get(q.id);
      if (c.pool === 'wrong' && !(p && p.last === false)) return false;
      if (c.pool === 'unsolved' && p) return false;
      if (c.pool === 'fav' && !S.favorites.has(q.id)) return false;
      if (c.topics && c.topics.length && !c.topics.some(k => inTopic(q.topic, k))) return false;
      if (srcSet.size && !sourceNames(q).some(n => srcSet.has(n))) return false;
      if (c.diffs && c.diffs.length && !c.diffs.includes(q.difficulty || 0)) return false;
      if (c.types && c.types.length && !c.types.includes(q.type || '')) return false;
      if (tokens.length) {
        const t = searchText(q);
        for (const tk of tokens) if (!t.includes(tk)) return false;
      }
      return true;
    });
  }

  function poolCounts() {
    let wrong = 0, unsolved = 0, fav = 0;
    for (const q of S.questions.values()) {
      const p = S.progress.get(q.id);
      if (!p) unsolved++; else if (p.last === false) wrong++;
      if (S.favorites.has(q.id)) fav++;
    }
    return { all: S.questions.size, wrong, unsolved, fav };
  }

  function buildTree(qs) {
    const rootNode = { name: '', key: '', count: 0, children: new Map() };
    for (const q of qs || sorted()) {
      let node = rootNode, key = '';
      rootNode.count++;
      for (const part of q.topic.split(' > ')) {
        key = key ? key + ' > ' + part : part;
        if (!node.children.has(part)) node.children.set(part, { name: part, key, count: 0, children: new Map() });
        node = node.children.get(part);
        node.count++;
      }
    }
    return rootNode;
  }

  function countBy(fn) {
    const m = new Map();
    for (const q of S.questions.values()) for (const k of [].concat(fn(q))) m.set(k, (m.get(k) || 0) + 1);
    return m;
  }

  const sourceCounts = () => countBy(sourceNames);
  const diffCounts = () => countBy(q => q.difficulty || 0);
  const typeCounts = () => countBy(q => q.type || '');

  // --- İçe aktarma ---
  // Hash → soru haritası; düzenlenmiş soruların eski içerik hash'leri (aliases) de dahil
  function hashMap() {
    const m = new Map();
    for (const q of S.questions.values()) {
      for (const a of q.aliases || []) if (!m.has(a)) m.set(a, q);
    }
    for (const q of S.questions.values()) m.set(q.hash, q);
    return m;
  }

  function sameSource(a, b) {
    return a.name.toLocaleLowerCase('tr') === b.name.toLocaleLowerCase('tr') && (a.page || '') === (b.page || '');
  }

  // src içindeki kaynak/etiket/dosya bilgilerini target'a ekler. Değiştiyse true.
  function mergeExtras(target, src) {
    let changed = false;
    target.sources = target.sources || [];
    for (const s of src.sources || []) {
      if (!target.sources.some(t => sameSource(t, s))) { target.sources.push(s); changed = true; }
    }
    target.related = target.related || [];
    const rel = new Set(target.related.map(r => r.toLocaleLowerCase('tr')));
    for (const r of src.related || []) {
      if (!rel.has(r.toLocaleLowerCase('tr'))) { target.related.push(r); rel.add(r.toLocaleLowerCase('tr')); changed = true; }
    }
    target.files = target.files || [];
    for (const f of src.files || []) if (!target.files.includes(f)) { target.files.push(f); changed = true; }
    return changed;
  }

  // Ayrıştırılmış dosyaları bankayla karşılaştır; her maddeye status ekler.
  function classify(files) {
    const bank = hashMap();
    const batch = new Map();
    const total = { found: 0, valid: 0, fresh: 0, dup: 0, errors: 0, warnings: 0, sourceAdds: 0 };
    for (const f of files) {
      const sm = { found: f.items.length, valid: 0, fresh: 0, dup: 0, errors: 0, warnings: 0 };
      for (const it of f.items) {
        if (it.errors.length) { it.status = 'error'; sm.errors++; continue; }
        sm.valid++;
        if (it.warnings.length) sm.warnings++;
        const h = it.question.hash;
        if (bank.has(h)) {
          it.status = 'dup-bank';
          const ex = bank.get(h);
          it.dupOf = ex;
          it.addsSource = mergeExtras(clone(ex), it.question);
          if (it.addsSource) total.sourceAdds++;
          sm.dup++;
        } else if (batch.has(h)) {
          it.status = 'dup-batch';
          it.dupOf = batch.get(h);
          sm.dup++;
        } else {
          it.status = 'new';
          batch.set(h, { fileName: f.fileName, label: it.label });
          sm.fresh++;
        }
      }
      f.summary = sm;
      for (const k of Object.keys(sm)) total[k] += sm[k];
    }
    return total;
  }

  async function commitImport(files) {
    const now = Date.now();
    let seq = 0, added = 0, merged = 0;
    const byHash = hashMap();
    const changed = new Map();
    for (const f of files) {
      for (const it of f.items) {
        if (it.status === 'error' || !it.question) continue;
        const nq = it.question;
        const ex = byHash.get(nq.hash);
        if (ex) {
          const target = changed.get(ex.id) || clone(ex);
          if (mergeExtras(target, nq)) {
            if (!changed.has(ex.id) && S.questions.has(ex.id)) merged++;
            changed.set(ex.id, target);
            byHash.set(nq.hash, target);
          }
        } else {
          let id = 'q_' + nq.hash;
          if (S.questions.has(id) || changed.has(id)) id += '_' + uid();
          const q = Object.assign({ id }, clone(nq), { createdAt: now, updatedAt: now, order: now * 1000 + seq++ });
          byHash.set(nq.hash, q);
          changed.set(id, q);
          added++;
        }
      }
    }
    if (changed.size) {
      await DB.putMany('questions', [...changed.values()]);
      for (const q of changed.values()) S.questions.set(q.id, q);
      invalidate();
      await touch();
    }
    return { added, merged };
  }

  // --- Çözüm / favori ---
  async function recordAnswer(test, qid, choice) {
    const q = S.questions.get(qid);
    if (!q || test.answers[qid]) return null;
    const a = { id: uid('a_'), qid, choice, correct: choice === q.answer, at: Date.now(), testId: test.id };
    test.answers[qid] = { choice, correct: a.correct, at: a.at };
    delete test.selections[qid];
    test.updatedAt = a.at;
    await DB.run(['attempts', 'tests'], 'readwrite', s => { s.attempts.put(a); s.tests.put(test); });
    S.attempts.push(a);
    S.attemptIds.add(a.id);
    addProgress(a);
    await touch();
    return a;
  }

  async function toggleFavorite(qid) {
    if (S.favorites.has(qid)) {
      await DB.del('favorites', qid);
      S.favorites.delete(qid);
    } else {
      const f = { qid, at: Date.now() };
      await DB.put('favorites', f);
      S.favorites.set(qid, f);
    }
    await touch();
    return S.favorites.has(qid);
  }

  // --- Testler ---
  async function createTest(qids, title, criteria) {
    const now = Date.now();
    const t = { id: uid('t_'), title, createdAt: now, updatedAt: now, qids: qids.slice(), answers: {}, selections: {}, index: 0, finishedAt: null, criteria: criteria || null };
    await DB.put('tests', t);
    S.tests.set(t.id, t);
    await touch();
    return t;
  }

  async function saveTest(t) {
    t.updatedAt = Date.now();
    await DB.put('tests', t);
    S.tests.set(t.id, t);
  }

  async function deleteTest(id) {
    await DB.del('tests', id);
    S.tests.delete(id);
    await touch();
  }

  function testList() {
    return [...S.tests.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function testStats(t) {
    const qids = t.qids.filter(id => S.questions.has(id));
    let correct = 0, wrong = 0;
    for (const id of qids) {
      const a = t.answers[id];
      if (a) { if (a.correct) correct++; else wrong++; }
    }
    return { total: qids.length, correct, wrong, blank: qids.length - correct - wrong, answered: correct + wrong, qids };
  }

  // --- Soru düzenleme ---
  async function updateQuestion(id, fields) {
    const q = S.questions.get(id);
    if (!q) throw new Error('Soru bulunamadı.');
    const n = Object.assign(clone(q), fields, { updatedAt: Date.now() });
    n.hash = QP.contentHash(n);
    if (n.hash !== q.hash) {
      // Eski içerik hash'ini sakla: orijinal dosya tekrar yüklenirse soru yinelenmesin
      n.aliases = (q.aliases || []).filter(a => a !== n.hash);
      if (!n.aliases.includes(q.hash)) n.aliases.push(q.hash);
    }
    for (const o of S.questions.values()) {
      if (o.id !== id && o.hash === n.hash) throw new Error('Aynı soru kökü, seçenekler ve cevapla başka bir soru zaten var.');
    }
    await DB.put('questions', n);
    S.questions.set(id, n);
    invalidate();
    await touch();
    return n;
  }

  async function deleteQuestion(id) {
    const attemptIds = S.attempts.filter(a => a.qid === id).map(a => a.id);
    await DB.run(['questions', 'favorites', 'attempts'], 'readwrite', s => {
      s.questions.delete(id);
      s.favorites.delete(id);
      for (const a of attemptIds) s.attempts.delete(a);
    });
    S.questions.delete(id);
    S.favorites.delete(id);
    const drop = new Set(attemptIds);
    S.attempts = S.attempts.filter(a => !drop.has(a.id));
    for (const a of drop) S.attemptIds.delete(a);
    invalidate();
    recompute();
    await touch();
  }

  // Konuyu yeniden adlandır / başka konuyla birleştir (alt konular da taşınır)
  async function renameTopic(oldKey, newKey) {
    const now = Date.now();
    const out = [];
    for (const q of S.questions.values()) {
      if (inTopic(q.topic, oldKey)) {
        const n = clone(q);
        n.topic = newKey + q.topic.slice(oldKey.length);
        n.updatedAt = now;
        out.push(n);
      }
    }
    if (out.length) {
      await DB.putMany('questions', out);
      for (const q of out) S.questions.set(q.id, q);
      invalidate();
      await touch();
    }
    return out.length;
  }

  async function renameSource(oldName, newName) {
    const now = Date.now();
    const out = [];
    for (const q of S.questions.values()) {
      if (!(q.sources || []).some(s => s.name === oldName)) continue;
      const n = clone(q);
      const list = [];
      for (const s of n.sources) {
        if (s.name === oldName) s.name = newName;
        if (!list.some(x => sameSource(x, s))) list.push(s);
      }
      n.sources = list;
      n.updatedAt = now;
      out.push(n);
    }
    if (out.length) {
      await DB.putMany('questions', out);
      for (const q of out) S.questions.set(q.id, q);
      invalidate();
      await touch();
    }
    return out.length;
  }

  // --- Yedek ---
  const BACKUP_FORMAT = 'kbb-soru-bankasi-yedek';

  function buildBackup() {
    return {
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      counts: { questions: S.questions.size, attempts: S.attempts.length, favorites: S.favorites.size, tests: S.tests.size },
      questions: sorted(),
      attempts: S.attempts,
      favorites: [...S.favorites.values()],
      tests: [...S.tests.values()]
    };
  }

  const isStr = v => typeof v === 'string';

  function cleanQuestion(q) {
    if (!q || !isStr(q.id) || !isStr(q.stem) || !q.options || !LETTERS.includes(q.answer)) return null;
    const options = {};
    for (const l of LETTERS) {
      if (!isStr(q.options[l]) || !q.options[l].trim()) return null;
      options[l] = q.options[l];
    }
    const topicPath = QP.splitTopic(q.topic);
    const n = {
      id: q.id,
      stem: q.stem,
      options,
      answer: q.answer,
      explanation: isStr(q.explanation) ? q.explanation : '',
      topic: topicPath.length ? topicPath.join(' > ') : 'Konusuz',
      related: Array.isArray(q.related) ? q.related.filter(isStr) : [],
      type: isStr(q.type) ? q.type : '',
      difficulty: Number.isInteger(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 5 ? q.difficulty : null,
      sources: Array.isArray(q.sources) ? q.sources.filter(s => s && isStr(s.name)).map(s => ({ name: s.name, page: isStr(s.page) ? s.page : '', raw: isStr(s.raw) ? s.raw : s.name, file: isStr(s.file) ? s.file : '' })) : [],
      files: Array.isArray(q.files) ? q.files.filter(isStr) : [],
      createdAt: Number(q.createdAt) || Date.now(),
      updatedAt: Number(q.updatedAt) || 0,
      order: Number(q.order) || 0,
      aliases: Array.isArray(q.aliases) ? q.aliases.filter(isStr) : []
    };
    n.hash = QP.contentHash(n);
    return n;
  }

  function cleanTest(t) {
    if (!t || !isStr(t.id) || !Array.isArray(t.qids)) return null;
    const answers = {};
    for (const [k, v] of Object.entries(t.answers || {})) {
      if (v && LETTERS.includes(v.choice)) answers[k] = { choice: v.choice, correct: !!v.correct, at: Number(v.at) || 0 };
    }
    const selections = {};
    for (const [k, v] of Object.entries(t.selections || {})) if (LETTERS.includes(v)) selections[k] = v;
    return {
      id: t.id,
      title: isStr(t.title) ? t.title : 'Test',
      createdAt: Number(t.createdAt) || Date.now(),
      updatedAt: Number(t.updatedAt) || 0,
      qids: t.qids.filter(isStr),
      answers,
      selections,
      index: Number.isInteger(t.index) ? t.index : 0,
      finishedAt: t.finishedAt ? Number(t.finishedAt) : null,
      criteria: t.criteria || null
    };
  }

  // JSON metnini doğrula ve temizlenmiş veriyi döndür
  function parseBackup(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('Dosya okunamadı: geçerli bir JSON değil.'); }
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.questions)) throw new Error('Bu dosya KBB Soru Bankası yedeği değil.');
    if (obj.format && obj.format !== BACKUP_FORMAT) throw new Error('Bu dosya KBB Soru Bankası yedeği değil.');
    const questions = [];
    let invalid = 0;
    for (const q of obj.questions) { const c = cleanQuestion(q); if (c) questions.push(c); else invalid++; }
    const attempts = (Array.isArray(obj.attempts) ? obj.attempts : [])
      .filter(a => a && isStr(a.id) && isStr(a.qid) && LETTERS.includes(a.choice))
      .map(a => ({ id: a.id, qid: a.qid, choice: a.choice, correct: !!a.correct, at: Number(a.at) || 0, testId: isStr(a.testId) ? a.testId : null }));
    const favorites = (Array.isArray(obj.favorites) ? obj.favorites : [])
      .filter(f => f && isStr(f.qid)).map(f => ({ qid: f.qid, at: Number(f.at) || 0 }));
    const tests = (Array.isArray(obj.tests) ? obj.tests : []).map(cleanTest).filter(Boolean);
    return { exportedAt: obj.exportedAt || null, questions, attempts, favorites, tests, invalid };
  }

  async function importBackup(data, mode) {
    const report = { added: 0, updated: 0, unchanged: 0, attempts: 0, favorites: 0, tests: 0 };
    if (mode === 'replace') {
      await DB.run(['questions', 'attempts', 'favorites', 'tests'], 'readwrite', s => {
        s.questions.clear(); s.attempts.clear(); s.favorites.clear(); s.tests.clear();
        const ids = new Set();
        for (const q of data.questions) { if (!ids.has(q.id)) { ids.add(q.id); s.questions.put(q); report.added++; } }
        for (const a of data.attempts) if (ids.has(a.qid)) { s.attempts.put(a); report.attempts++; }
        for (const f of data.favorites) if (ids.has(f.qid)) { s.favorites.put(f); report.favorites++; }
        for (const t of data.tests) { s.tests.put(t); report.tests++; }
      });
    } else {
      const byHash = hashMap();
      const pending = new Map();
      const idMap = new Map();
      for (const bq of data.questions) {
        const ex = pending.get(bq.id) || S.questions.get(bq.id) || byHash.get(bq.hash);
        if (ex) {
          idMap.set(bq.id, ex.id);
          const newer = (bq.updatedAt || 0) > (ex.updatedAt || 0);
          const m = newer ? Object.assign(clone(bq), { id: ex.id, createdAt: ex.createdAt, order: ex.order }) : clone(ex);
          mergeExtras(m, newer ? ex : bq);
          if (JSON.stringify(m) !== JSON.stringify(ex)) {
            if (!pending.has(ex.id)) report.updated++;
            pending.set(ex.id, m);
            byHash.set(m.hash, m);
          } else if (!pending.has(ex.id)) report.unchanged++;
        } else {
          const q = clone(bq);
          if (!q.order) q.order = Date.now() * 1000 + report.added;
          pending.set(q.id, q);
          byHash.set(q.hash, q);
          idMap.set(bq.id, q.id);
          report.added++;
        }
      }
      const finalIds = new Set([...S.questions.keys(), ...pending.keys()]);
      const mapId = id => idMap.get(id) || id;
      const attempts = [];
      for (const a of data.attempts) {
        const qid = mapId(a.qid);
        if (!finalIds.has(qid) || S.attemptIds.has(a.id)) continue;
        attempts.push(Object.assign({}, a, { qid }));
      }
      const favorites = [];
      for (const f of data.favorites) {
        const qid = mapId(f.qid);
        if (finalIds.has(qid) && !S.favorites.has(qid) && !favorites.some(x => x.qid === qid)) favorites.push({ qid, at: f.at });
      }
      const tests = [];
      for (const bt of data.tests) {
        const t = clone(bt);
        t.qids = t.qids.map(mapId);
        const remap = o => { const r = {}; for (const [k, v] of Object.entries(o)) r[mapId(k)] = v; return r; };
        t.answers = remap(t.answers);
        t.selections = remap(t.selections);
        const ex = S.tests.get(t.id);
        if (!ex || (t.updatedAt || 0) > (ex.updatedAt || 0)) tests.push(t);
      }
      report.attempts = attempts.length;
      report.favorites = favorites.length;
      report.tests = tests.length;
      await DB.run(['questions', 'attempts', 'favorites', 'tests'], 'readwrite', s => {
        for (const q of pending.values()) s.questions.put(q);
        for (const a of attempts) s.attempts.put(a);
        for (const f of favorites) s.favorites.put(f);
        for (const t of tests) s.tests.put(t);
      });
    }
    await load();
    await touch();
    return report;
  }

  async function clearAll() {
    await DB.run(DB.STORES, 'readwrite', s => { for (const n of DB.STORES) s[n].clear(); });
    await load();
  }

  root.Store = {
    S, LETTERS, uid, load, setMeta, sorted, fold, filter, emptyCrit, poolCounts, buildTree, inTopic,
    sourceNames, sourceCounts, diffCounts, typeCounts, classify, commitImport, recordAnswer, toggleFavorite,
    createTest, saveTest, deleteTest, testList, testStats, updateQuestion, deleteQuestion, renameTopic,
    renameSource, buildBackup, parseBackup, importBackup, clearAll
  };
})(window);
