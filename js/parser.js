/*
 * Markdown soru dosyası ayrıştırıcı.
 * <!-- QUESTION_START --> ... <!-- QUESTION_END --> bloklarını okur.
 * Tarayıcıda window.QP, Node'da module.exports olarak kullanılır.
 */
(function (root) {
  'use strict';

  const LETTERS = ['A', 'B', 'C', 'D', 'E'];

  // --- Hash (senkron, bağımlılıksız; iki tohumlu cyrb53 ≈ 106 bit) ---
  function cyrb53(str, seed) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  function hashString(s) {
    return cyrb53(s, 0).toString(36).padStart(11, '0') + cyrb53(s, 0x9e3779b9).toString(36).padStart(11, '0');
  }

  // Karşılaştırma için metni normalize et (büyük/küçük harf, boşluk, vurgu işaretleri)
  function normText(s) {
    return String(s || '')
      .normalize('NFC')
      .replace(/\*\*|__/g, '')
      .toLocaleLowerCase('tr')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function contentHash(q) {
    const parts = [normText(q.stem)];
    for (const l of LETTERS) parts.push(normText(q.options && q.options[l]));
    parts.push(String(q.answer || '').toUpperCase());
    return hashString(parts.join('␞'));
  }

  // Türkçe karakterleri sadeleştirerek anahtar üret
  function foldKey(s) {
    return String(s || '')
      .replace(/İ/g, 'i').replace(/I/g, 'ı')
      .toLocaleLowerCase('tr')
      .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
      .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function splitTopic(s) {
    return String(s || '').split('>').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  function splitTags(s) {
    const seen = new Set();
    const out = [];
    for (const t of String(s || '').split(/[,;]/)) {
      const v = t.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
      const k = v.toLocaleLowerCase('tr');
      if (v && !seen.has(k)) { seen.add(k); out.push(v); }
    }
    return out;
  }

  // "Kitap adı; s. 45" → { name, page, raw }
  function parseSource(raw) {
    raw = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!raw) return null;
    let name = raw, page = '';
    const semi = raw.indexOf(';');
    if (semi >= 0) {
      name = raw.slice(0, semi).trim();
      page = raw.slice(semi + 1).trim();
    } else {
      const m = /^(.*?)[\s,\-–—(]+((?:s\.|sf\.?|syf\.?|sayfa(?:lar)?|p\.|pp\.|page|pages)\s*\d[\d\s\-–,]*)\)?\s*$/i.exec(raw);
      if (m && m[1].trim()) { name = m[1].trim(); page = m[2].trim(); }
    }
    name = name.replace(/[\s,;:\-–—]+$/, '');
    if (/^(yok|-|—|–|belirtilmemiş|belirtilmemis|yok\.)$/i.test(page)) page = '';
    return { name: name || raw, page, raw };
  }

  function sectionOf(headingText) {
    const k = foldKey(headingText);
    if (k === 'soru' || k === 'sorukoku' || k === 'sorumetni') return 'stem';
    if (k === 'dogrucevap' || k === 'cevap' || k === 'dogruyanit' || k === 'yanit' || k === 'cevapanahtari') return 'answer';
    if (k === 'aciklama' || k === 'aciklamalar' || k === 'cozum' || k === 'cozumaciklama') return 'expl';
    return null;
  }

  const META_KEYS = {
    konu: 'topic',
    iliskilikonular: 'related', iliskilikonu: 'related', etiketler: 'related', etiket: 'related',
    sorutipi: 'type', tip: 'type',
    zorluk: 'difficulty',
    kaynak: 'source', kaynaklar: 'source'
  };

  const OPTION_RE = /^\s{0,3}(?:[-*]\s+)?(?:\*\*|__)?\(?([A-E])(?:\*\*|__)?\s*[).](?:\*\*|__)?(?:\s+|$)(.*)$/;

  function trimLines(arr) {
    let a = 0, b = arr.length;
    while (a < b && !arr[a].trim()) a++;
    while (b > a && !arr[b - 1].trim()) b--;
    return arr.slice(a, b);
  }

  function parseOptions(lines) {
    // Seçenek satırlarını sondan başa doğru ara: son E'den önceki son D ... A
    const marks = lines.map(l => { const m = OPTION_RE.exec(l); return m ? m[1] : null; });
    const pos = {};
    let limit = lines.length;
    for (let k = LETTERS.length - 1; k >= 0; k--) {
      const L = LETTERS[k];
      let found = -1;
      for (let i = limit - 1; i >= 0; i--) if (marks[i] === L) { found = i; break; }
      if (found < 0) break;
      pos[L] = found;
      limit = found;
    }
    const missing = LETTERS.filter(L => pos[L] === undefined);
    if (missing.length) {
      // Hangi harflerin hiç bulunmadığını bildir
      const present = new Set(marks.filter(Boolean));
      const never = LETTERS.filter(L => !present.has(L));
      return { error: never.length ? 'Seçenek bulunamadı: ' + never.join(', ') : 'Seçenekler A–E sırasında değil' };
    }
    const stem = trimLines(lines.slice(0, pos.A)).join('\n');
    const options = {};
    for (let k = 0; k < LETTERS.length; k++) {
      const L = LETTERS[k];
      const start = pos[L];
      const end = k < 4 ? pos[LETTERS[k + 1]] : lines.length;
      const first = OPTION_RE.exec(lines[start])[2];
      options[L] = trimLines([first].concat(lines.slice(start + 1, end))).join('\n').trim();
    }
    return { stem, options };
  }

  function parseAnswer(text) {
    const clean = String(text || '').replace(/[*_`]/g, ' ');
    const m = /(?:^|[^A-Za-zÇĞİÖŞÜçğıöşü])([A-Za-z])(?=$|[^A-Za-zÇĞİÖŞÜçğıöşü])/.exec(clean);
    if (!m) return { error: 'Doğru cevap bulunamadı' };
    const L = m[1].toUpperCase();
    if (!LETTERS.includes(L)) return { error: 'Doğru cevap A–E arasında olmalı (bulunan: ' + m[1] + ')' };
    return { answer: L };
  }

  function parseBlock(raw, index, fileName, extraWarnings) {
    const lines = raw.split('\n');
    let label = '';
    const meta = {};
    const sections = {};
    let current = null;
    let inFence = false;

    for (const line of lines) {
      if (/^\s*```/.test(line)) inFence = !inFence;
      const h = inFence ? null : /^\s{0,3}#{1,4}\s+(.+?)\s*#*\s*$/.exec(line);
      if (h) {
        const sec = sectionOf(h[1]);
        if (sec) { current = sec; sections[sec] = sections[sec] || []; continue; }
        if (!current && /^soru\b/i.test(h[1].trim())) { label = h[1].trim(); continue; }
      }
      if (!current) {
        const m = /^\s*(?:[-*]\s+)?\*\*\s*([^*]+?)\s*:?\s*\*\*\s*:?\s*(.*)$/.exec(line);
        if (m) {
          const key = META_KEYS[foldKey(m[1])];
          if (key) meta[key] = m[2].trim();
        }
        continue;
      }
      sections[current].push(line);
    }

    const result = {
      index,
      label: label || 'Soru ' + (index + 1),
      fileName,
      errors: [],
      warnings: extraWarnings ? extraWarnings.slice() : [],
      question: null
    };

    let stem = '', options = null, answer = null;
    if (!sections.stem) {
      result.errors.push('"### SORU" bölümü bulunamadı');
    } else {
      const op = parseOptions(sections.stem);
      if (op.error) result.errors.push(op.error);
      else {
        stem = op.stem; options = op.options;
        if (!stem.trim()) result.errors.push('Soru kökü boş');
        const empty = LETTERS.filter(L => !options[L]);
        if (empty.length) result.errors.push('Boş seçenek: ' + empty.join(', '));
      }
    }
    if (!sections.answer) {
      result.errors.push('"### DOĞRU CEVAP" bölümü bulunamadı');
    } else {
      const an = parseAnswer(sections.answer.join('\n'));
      if (an.error) result.errors.push(an.error); else answer = an.answer;
    }
    const explanation = sections.expl ? trimLines(sections.expl).join('\n') : '';
    if (!explanation) result.warnings.push('Açıklama yok');

    let topicPath = splitTopic(meta.topic);
    if (!topicPath.length) { topicPath = ['Konusuz']; result.warnings.push('Konu belirtilmemiş'); }

    let difficulty = null;
    if (meta.difficulty) {
      const d = /[1-5]/.exec(meta.difficulty);
      if (d) difficulty = Number(d[0]); else result.warnings.push('Zorluk okunamadı: ' + meta.difficulty);
    }

    const src = parseSource(meta.source);
    if (!src) result.warnings.push('Kaynak belirtilmemiş');

    if (!result.errors.length) {
      const q = {
        stem,
        options,
        answer,
        explanation,
        topic: topicPath.join(' > '),
        related: splitTags(meta.related),
        type: (meta.type || '').trim(),
        difficulty,
        sources: src ? [Object.assign(src, { file: fileName || '' })] : [],
        files: fileName ? [fileName] : []
      };
      q.hash = contentHash(q);
      result.question = q;
    }
    return result;
  }

  function splitBlocks(text) {
    const START = /<!--\s*QUESTION_START\s*-->/gi;
    const END = /<!--\s*QUESTION_END\s*-->/i;
    const blocks = [];
    if (START.test(text)) {
      const parts = text.split(/<!--\s*QUESTION_START\s*-->/i).slice(1);
      for (const p of parts) {
        const m = END.exec(p);
        blocks.push({ raw: m ? p.slice(0, m.index) : p.replace(/<!--\s*QUESTION_END\s*-->[\s\S]*$/i, ''), warnings: m ? [] : ['QUESTION_END işareti eksik'] });
      }
      return blocks;
    }
    // İşaret yoksa "## Soru" başlıklarına göre böl
    const re = /^\s{0,3}#{1,3}\s+Soru\b.*$/gim;
    const idx = [];
    let m;
    while ((m = re.exec(text))) idx.push(m.index);
    for (let i = 0; i < idx.length; i++) {
      blocks.push({ raw: text.slice(idx[i], i + 1 < idx.length ? idx[i + 1] : text.length), warnings: [] });
    }
    return blocks;
  }

  function parseFile(text, fileName) {
    text = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
    const blocks = splitBlocks(text);
    const items = blocks.map((b, i) => parseBlock(b.raw, i, fileName, b.warnings));
    return { fileName, items };
  }

  const api = { LETTERS, parseFile, parseSource, contentHash, hashString, normText, foldKey, splitTopic, splitTags };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QP = api;
})(typeof window !== 'undefined' ? window : this);
