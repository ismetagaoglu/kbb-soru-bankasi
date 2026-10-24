/*
 * Küçük ve güvenli Markdown görüntüleyici.
 * Tüm metin önce HTML-escape edilir; ham HTML asla sayfaya geçmez.
 * Destek: paragraf, başlık, kalın/italik/üstü çizili, satır içi kod, kod bloğu,
 * sıralı/sırasız (iç içe) liste, tablo, alıntı, yatay çizgi, http(s) bağlantı, <br>.
 */
(function (root) {
  'use strict';

  function escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function inline(text) {
    let s = escape(text);
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__(?=\S)([\s\S]*?\S)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
    s = s.replace(/\^([0-9A-Za-z+\-]{1,6})\^/g, '<sup>$1</sup>');
    s = s.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + codes[Number(i)] + '</code>');
    return s;
  }

  const LIST_RE = /^(\s*)([-*+]|\d{1,3}[.)])\s+/;
  const HR_RE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
  const HEAD_RE = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
  const SEP_RE = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

  const indentOf = l => /^\s*/.exec(l)[0].length;

  function isTableStart(lines, i) {
    return lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].includes('-') && SEP_RE.test(lines[i + 1]);
  }

  function isBlockStart(lines, i) {
    const l = lines[i];
    return /^\s*```/.test(l) || HEAD_RE.test(l) || HR_RE.test(l) || /^\s*>/.test(l) || LIST_RE.test(l) || isTableStart(lines, i);
  }

  function splitRow(l) {
    let s = l.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
    return s.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
  }

  function table(lines, i) {
    const head = splitRow(lines[i]);
    const aligns = splitRow(lines[i + 1]).map(c => /^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : '');
    i += 2;
    const rows = [];
    while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
    const cell = (tag, c, k) => '<' + tag + (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : '') + '>' + inline(c) + '</' + tag + '>';
    let html = '<div class="table-wrap"><table><thead><tr>' + head.map((c, k) => cell('th', c, k)).join('') + '</tr></thead><tbody>';
    for (const r of rows) {
      const cells = [];
      for (let k = 0; k < head.length; k++) cells.push(cell('td', r[k] || '', k));
      html += '<tr>' + cells.join('') + '</tr>';
    }
    return { html: html + '</tbody></table></div>', i };
  }

  function list(lines, i) {
    const first = LIST_RE.exec(lines[i]);
    const base = first[1].length;
    const ordered = /\d/.test(first[2]);
    const start = ordered ? parseInt(first[2], 10) : 1;
    const items = [];
    let cur = null, contentIndent = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length && cur && (indentOf(lines[j]) > base)) { cur.push(''); i++; continue; }
        const nm = j < lines.length ? LIST_RE.exec(lines[j]) : null;
        if (nm && nm[1].length === base && /\d/.test(nm[2]) === ordered) { i = j; continue; }
        break;
      }
      const m = LIST_RE.exec(l);
      if (m && m[1].length <= base + 1 && m[1].length >= base) {
        if (/\d/.test(m[2]) !== ordered) break;
        cur = [l.slice(m[0].length)];
        contentIndent = m[0].length;
        items.push(cur);
        i++;
        continue;
      }
      if (m && m[1].length < base) break;
      if (cur && indentOf(l) > base) {
        cur.push(l.replace(new RegExp('^ {0,' + contentIndent + '}'), ''));
        i++;
        continue;
      }
      if (cur && !isBlockStart(lines, i)) { cur.push(l.trim()); i++; continue; }
      break;
    }
    const tag = ordered ? 'ol' : 'ul';
    const attr = ordered && start !== 1 ? ' start="' + start + '"' : '';
    const html = '<' + tag + attr + '>' + items.map(it => '<li>' + blocks(it) + '</li>').join('') + '</' + tag + '>';
    return { html, i };
  }

  function blocks(lines) {
    let i = 0, html = '';
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      if (/^\s*```/.test(line)) {
        const buf = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        html += '<pre><code>' + escape(buf.join('\n')) + '</code></pre>';
        continue;
      }
      let m = HEAD_RE.exec(line);
      if (m) {
        const lvl = Math.min(6, m[1].length + 2);
        html += '<h' + lvl + '>' + inline(m[2]) + '</h' + lvl + '>';
        i++;
        continue;
      }
      if (HR_RE.test(line) && !LIST_RE.test(line.replace(/^(\s*[-*])\s+[-*]/, ''))) { html += '<hr>'; i++; continue; }
      if (isTableStart(lines, i)) { const r = table(lines, i); html += r.html; i = r.i; continue; }
      if (/^\s*>/.test(line)) {
        const buf = [];
        while (i < lines.length && lines[i].trim() && (/^\s*>/.test(lines[i]) || !isBlockStart(lines, i))) {
          buf.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        html += '<blockquote>' + blocks(buf) + '</blockquote>';
        continue;
      }
      if (LIST_RE.test(line)) { const r = list(lines, i); html += r.html; i = r.i; continue; }

      const buf = [];
      while (i < lines.length && lines[i].trim() && (buf.length === 0 || !isBlockStart(lines, i))) buf.push(lines[i++].trim());
      html += '<p>' + buf.map(inline).join('<br>') + '</p>';
    }
    return html;
  }

  function render(src) {
    const lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
    return blocks(lines);
  }

  // Önizleme için Markdown işaretlerinden arındırılmış düz metin
  function plain(src, max) {
    let s = String(src || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/gm, ' ')
      .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d{1,3}[.)])\s+/gm, '')
      .replace(/\*\*|__|~~|`/g, '')
      .replace(/(^|\s)[*_](?=\S)|(\S)[*_](?=\s|$|[.,;:!?])/g, '$1$2')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/^[ \t]*\||\|[ \t]*$/gm, '')
      .replace(/\s*\|\s*/g, ' · ')
      .replace(/\s+/g, ' ').trim();
    if (max && s.length > max) s = s.slice(0, max - 1).trimEnd() + '…';
    return s;
  }

  const api = { render, inline, escape, plain };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MD = api;
})(typeof window !== 'undefined' ? window : this);
