/*
 * Arayüz: sayfa yönlendirme ve görünümler.
 */
(function () {
  'use strict';
  const { S } = Store;
  const LETTERS = Store.LETTERS;
  const esc = MD.escape;
  const md = MD.render;
  const view = document.getElementById('view');

  // ---------- Yardımcılar ----------
  const fmtNum = n => Number(n || 0).toLocaleString('tr-TR');
  const pct = (a, b) => (b ? '%' + Math.round((a / b) * 100) : '—');
  const dateFmt = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
  const fmtDate = ts => (ts ? dateFmt.format(new Date(ts)) : '—');

  function relTime(ts) {
    if (!ts) return '—';
    const diff = Date.now() - ts;
    const m = Math.round(diff / 60000);
    if (m < 1) return 'az önce';
    if (m < 60) return m + ' dk önce';
    const h = Math.round(m / 60);
    if (h < 24) return h + ' saat önce';
    const d = Math.round(h / 24);
    if (d === 1) return 'dün';
    if (d < 30) return d + ' gün önce';
    return fmtDate(ts);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function lsGet(key, def) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* önemsiz tercih */ }
  }

  const sourceLabel = n => (n ? n : 'Kaynak belirtilmemiş');
  const diffLabel = d => (d ? d + '/5' : 'Belirtilmemiş');
  const typeLabel = t => (t ? t : 'Belirtilmemiş');
  const lastSeg = topic => topic.split(' > ').pop();

  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function sourcesText(q) {
    if (!q.sources || !q.sources.length) return '';
    return q.sources.map(s => s.name + (s.page ? ' · ' + s.page : '')).join('; ');
  }

  const ICON = {
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4"/></svg>',
    upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>',
    file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>'
  };

  // ---------- Bildirim ve pencere ----------
  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    document.getElementById('toastRoot').appendChild(el);
    setTimeout(() => el.classList.add('hide'), 3200);
    setTimeout(() => el.remove(), 3700);
  }

  let modalOpen = false;
  // actions: [{label, value, kind}] — onSubmit(value, root) false dönerse pencere kapanmaz
  function modal({ title, body, actions, onOpen, onSubmit, wide }) {
    return new Promise(resolve => {
      const rootEl = document.getElementById('modalRoot');
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML =
        '<div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="mTitle">' +
        '<h2 id="mTitle">' + esc(title) + '</h2>' +
        '<div class="modal-body">' + body + '</div>' +
        '<p class="modal-error" hidden></p>' +
        '<div class="modal-actions">' +
        actions.map((a, i) => '<button type="button" class="btn ' + (a.kind || '') + '" data-i="' + i + '">' + esc(a.label) + '</button>').join('') +
        '</div></div>';
      const prevFocus = document.activeElement;
      rootEl.appendChild(wrap);
      modalOpen = true;
      document.body.classList.add('no-scroll');
      const close = v => {
        wrap.remove();
        modalOpen = !!rootEl.children.length;
        if (!modalOpen) document.body.classList.remove('no-scroll');
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        resolve(v);
      };
      const errEl = wrap.querySelector('.modal-error');
      wrap.addEventListener('click', async e => {
        if (e.target === wrap) { close(null); return; }
        const b = e.target.closest('button[data-i]');
        if (!b) return;
        const a = actions[Number(b.dataset.i)];
        if (a.value == null) { close(null); return; }
        if (onSubmit) {
          errEl.hidden = true;
          b.disabled = true;
          try {
            const r = await onSubmit(a.value, wrap);
            if (r === false) { b.disabled = false; return; }
          } catch (err) {
            errEl.textContent = err.message || String(err);
            errEl.hidden = false;
            b.disabled = false;
            return;
          }
        }
        close(a.value);
      });
      wrap.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.stopPropagation(); close(null); }
      });
      if (onOpen) onOpen(wrap);
      const f = wrap.querySelector('input, textarea, select') || wrap.querySelector('.modal-actions .btn.primary, .modal-actions .btn.danger');
      if (f) f.focus();
    });
  }

  function confirmBox(title, text, okLabel, danger) {
    return modal({
      title,
      body: '<p>' + esc(text) + '</p>',
      actions: [{ label: 'Vazgeç', value: null, kind: 'ghost' }, { label: okLabel || 'Tamam', value: true, kind: danger ? 'danger' : 'primary' }]
    }).then(v => v === true);
  }

  // ---------- Tema ----------
  const themeBtn = document.getElementById('themeBtn');
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    themeBtn.innerHTML = t === 'light' ? ICON.sun : t === 'dark' ? ICON.moon : ICON.auto;
    const label = t === 'light' ? 'Açık tema' : t === 'dark' ? 'Koyu tema' : 'Sistem teması';
    themeBtn.title = label + ' (değiştirmek için tıklayın)';
    themeBtn.setAttribute('aria-label', label + ' — değiştir');
  }
  let theme = 'auto';
  try { theme = localStorage.getItem('kbb.theme') || 'auto'; } catch (e) { /* yok say */ }
  applyTheme(theme);
  themeBtn.addEventListener('click', () => {
    theme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
    try { localStorage.setItem('kbb.theme', theme); } catch (e) { /* yok say */ }
    applyTheme(theme);
    toast(theme === 'light' ? 'Açık tema' : theme === 'dark' ? 'Koyu tema' : 'Sistem teması');
  });

  // ---------- Uygulama olarak yükleme (PWA) ----------
  const installBtn = document.getElementById('installBtn');
  let installPrompt = null;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* çevrimdışı destek olmadan devam */ }); });
  }
  const refreshHome = () => { if ((location.hash || '#/').split('?')[0] === '#/') route(); };
  const ua = navigator.userAgent;
  const isAndroid = /android/i.test(ua);
  // Instagram, Facebook, WhatsApp vb. uygulama içi tarayıcılar kurulumu desteklemez
  const inAppBrowser = /FBAN|FBAV|Instagram|Line\/|WhatsApp|Telegram|; wv\)|GSA\//i.test(ua);
  const iosNotSafari = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  const canInstallHere = () => !isStandalone() && location.protocol !== 'file:';
  function syncInstallBtn() { installBtn.hidden = !canInstallHere(); }
  syncInstallBtn();

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e;
    syncInstallBtn();
    refreshHome();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installBtn.hidden = true;
    toast('Uygulama yüklendi. Ana ekranınızdan açabilirsiniz.', 'ok');
    requestPersist();
    refreshHome();
  });
  window.matchMedia('(display-mode: standalone)').addEventListener('change', syncInstallBtn);

  function installSteps() {
    const li = a => '<ol class="steps">' + a.map(x => '<li>' + x + '</li>').join('') + '</ol>';
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      return '<p>Bu adres güvenli bağlantı (<strong>https</strong>) kullanmadığı için tarayıcılar uygulama kurulumuna izin vermez.</p>' +
        '<p>Kurulum için şu adresi açın:<br><a href="https://ismetagaoglu.github.io/kbb-soru-bankasi/">ismetagaoglu.github.io/kbb-soru-bankasi</a></p>';
    }
    if (inAppBrowser) {
      return '<p>Şu an bir uygulamanın içindeki tarayıcıdasınız (Instagram, WhatsApp vb.). Burada kurulum yapılamaz.</p>' +
        li(['Sağ üstteki <strong>⋮</strong> veya <strong>…</strong> menüsüne dokunun.', '<strong>' + (isIOS ? 'Safari\'de aç' : 'Tarayıcıda aç / Chrome\'da aç') + '</strong> seçeneğini seçin.', 'Açılan sayfada tekrar <strong>Uygulamayı Yükle</strong>\'ye dokunun.']);
    }
    if (isIOS) {
      return (iosNotSafari ? '<p class="warn-text small">iPhone\'da kurulum en sorunsuz <strong>Safari</strong> ile yapılır. Bu sayfayı Safari\'de açmanız önerilir.</p>' : '') +
        li(['Alttaki (veya üstteki) <strong>Paylaş</strong> simgesine dokunun <span class="muted">(kare ve yukarı ok)</span>.', 'Listeyi aşağı kaydırıp <strong>Ana Ekrana Ekle</strong>\'yi seçin.', 'Sağ üstte <strong>Ekle</strong>\'ye dokunun.']) +
        '<p class="muted small">Not: Ana ekrandan açılan uygulama Safari\'den ayrı depolama kullanır. Safari\'de yüklediğiniz soruları uygulamaya <strong>Yedek İndir / Yedeği Yükle</strong> ile taşıyın.</p>';
    }
    if (isAndroid) {
      return li(['Chrome\'da sağ üstteki <strong>⋮</strong> menüsüne dokunun.', '<strong>Uygulamayı yükle</strong> ya da <strong>Ana ekrana ekle</strong>\'yi seçin.', 'Açılan pencerede <strong>Yükle</strong>\'ye dokunun.']) +
        '<p class="muted small">Samsung İnternet\'te: alttaki menü (☰) → <strong>Sayfayı ekle</strong> → <strong>Ana ekran</strong>.</p>';
    }
    return li(['Chrome veya Edge\'de adres çubuğunun sağındaki <strong>yükle</strong> simgesine tıklayın <span class="muted">(ekran ve aşağı ok)</span>.', 'Simge yoksa menüden (<strong>⋮</strong> / <strong>…</strong>) <strong>Yayınla, kaydet ve paylaş → Sayfayı uygulama olarak yükle</strong> ya da <strong>Uygulamalar → Bu siteyi uygulama olarak yükle</strong>\'yi seçin.']) +
      '<p class="muted small">Safari (Mac): <strong>Dosya → Dock\'a Ekle</strong>. Firefox masaüstünde uygulama kurulumu desteklenmez.</p>';
  }

  async function promptInstall() {
    if (installPrompt) {
      const p = installPrompt;
      installPrompt = null;
      p.prompt();
      try { await p.userChoice; } catch (e) { /* yok say */ }
      refreshHome();
      return;
    }
    await modal({
      title: 'Uygulama olarak yükle',
      body: '<div class="install-help"><img src="icons/icon-192.png" alt="" width="52" height="52">' +
        '<p>Yüklenen uygulama ana ekrandan tek dokunuşla, tam ekran açılır ve <strong>internet olmadan da çalışır</strong>.</p></div>' + installSteps(),
      actions: [{ label: 'Tamam', value: null, kind: 'primary' }]
    });
  }
  installBtn.addEventListener('click', promptInstall);

  function installCard() {
    if (!canInstallHere() || lsGet('kbb.installDismissed', false)) return '';
    const body = '<p>Ana ekrandan tek dokunuşla açılır, tam ekran çalışır ve internet olmadan da kullanılabilir.</p>' +
      '<div class="row wrap"><button type="button" class="btn primary" data-install>' + ICON.download + 'Uygulamayı Yükle</button>' +
      '<button type="button" class="btn ghost" data-install-dismiss>Şimdi değil</button></div>';
    return '<section class="card install-card"><div class="install-icon"><img src="icons/icon-192.png" alt="" width="44" height="44"></div>' +
      '<div class="install-text"><h2 class="card-title">Uygulama olarak yükle</h2>' + body + '</div></section>';
  }

  function bindInstallCard() {
    const b = view.querySelector('[data-install]');
    if (b) b.addEventListener('click', promptInstall);
    const d = view.querySelector('[data-install-dismiss]');
    if (d) d.addEventListener('click', () => { lsSet('kbb.installDismissed', true); d.closest('.install-card').remove(); toast('Yüklemek isterseniz üstteki Yükle düğmesini kullanabilirsiniz.'); });
  }

  // ---------- Yedek indirme ----------
  function downloadBackup() {
    const data = Store.buildBackup();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
      '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
    a.href = url;
    a.download = 'kbb-soru-bankasi-yedek-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    Store.setMeta('lastBackupAt', Date.now());
    toast('Yedek indirildi: ' + fmtNum(data.questions.length) + ' soru', 'ok');
  }

  function backupStatus() {
    const last = S.meta.lastBackupAt;
    const changed = S.meta.lastChangeAt;
    if (!S.questions.size) return { needed: false, text: 'Henüz veri yok.' };
    if (!last) return { needed: true, text: 'Henüz hiç yedek almadınız.' };
    const stale = changed && changed > last;
    return {
      needed: stale && Date.now() - last > 3 * 864e5,
      text: 'Son yedek: ' + relTime(last) + (stale ? ' · sonrasında değişiklik var' : ' · güncel')
    };
  }

  async function requestPersist() {
    try {
      if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
    } catch (e) { /* desteklenmiyor */ }
  }

  // ---------- Ortak parçalar ----------
  function statCard(label, value, sub, extraClass, href) {
    const tag = href ? 'a' : 'div';
    return '<' + tag + ' class="stat ' + (extraClass || '') + '"' + (href ? ' href="' + href + '"' : '') + '>' +
      '<div class="stat-label">' + esc(label) + '</div>' +
      '<div class="stat-value">' + value + '</div>' +
      (sub ? '<div class="stat-sub">' + sub + '</div>' : '') + '</' + tag + '>';
  }

  function emptyBank() {
    return '<section class="card empty">' +
      '<div class="empty-icon">' + ICON.file + '</div>' +
      '<h2>Soru bankanız boş</h2>' +
      '<p>Markdown (.md) soru dosyalarınızı yükleyerek başlayın. Başka bir cihazdan yedeğiniz varsa onu da yükleyebilirsiniz.</p>' +
      '<div class="row center"><a class="btn primary" href="#/yukle">' + ICON.upload + 'Dosya Yükle</a>' +
      '<a class="btn ghost" href="#/yukle?yedek">Yedeği Yükle</a></div></section>';
  }

  function topicTreeHTML(node, opts, depth) {
    depth = depth || 0;
    const kids = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    if (!kids.length) return '';
    let html = '<ul class="tree' + (depth ? ' sub' : '') + '"' + (depth ? ' hidden' : '') + '>';
    for (const k of kids) {
      const has = k.children.size > 0;
      html += '<li data-key="' + esc(k.key) + '">' +
        '<div class="tree-row">' +
        (has ? '<button type="button" class="tree-toggle" aria-label="Alt konuları göster" aria-expanded="false">' + ICON.chev + '</button>' : '<span class="tree-spacer"></span>') +
        '<label class="tree-label"><input type="checkbox" data-topic="' + esc(k.key) + '"><span>' + esc(k.name) + '</span></label>' +
        '<span class="count">' + fmtNum(k.count) + '</span>' +
        (opts.manage ? '<button type="button" class="mini-btn" data-rename-topic="' + esc(k.key) + '" title="Yeniden adlandır / birleştir" aria-label="' + esc(k.name) + ' konusunu yeniden adlandır">' + ICON.edit + '</button>' : '') +
        '</div>' +
        topicTreeHTML(k, opts, depth + 1) +
        '</li>';
    }
    return html + '</ul>';
  }

  // Ağaçtaki onay kutularını seçili konulara göre eşitle; üst konu seçiliyse altlar kilitli
  function syncTree(container, selected) {
    const sel = new Set(selected);
    container.querySelectorAll('input[data-topic]').forEach(inp => {
      const key = inp.dataset.topic;
      let byParent = false;
      for (const s of sel) if (s !== key && key.startsWith(s + ' > ')) { byParent = true; break; }
      inp.checked = sel.has(key) || byParent;
      inp.disabled = byParent;
      let partial = false;
      if (!inp.checked) for (const s of sel) if (s.startsWith(key + ' > ')) { partial = true; break; }
      inp.indeterminate = partial;
    });
  }

  function bindTree(container, getSel, onChange) {
    container.addEventListener('click', e => {
      const t = e.target.closest('.tree-toggle');
      if (!t) return;
      const ul = t.closest('li').querySelector(':scope > ul');
      const open = ul.hidden;
      ul.hidden = !open;
      t.setAttribute('aria-expanded', String(open));
    });
    container.addEventListener('change', e => {
      const inp = e.target.closest('input[data-topic]');
      if (!inp) return;
      const key = inp.dataset.topic;
      let sel = getSel().filter(k => k !== key);
      if (inp.checked) sel = sel.filter(k => !k.startsWith(key + ' > ')).concat(key);
      onChange(sel);
      syncTree(container, sel);
    });
    // Seçili alt konuların üstlerini aç
    syncTree(container, getSel());
    for (const k of getSel()) {
      const parts = k.split(' > ');
      for (let i = 1; i < parts.length; i++) {
        const li = container.querySelector('li[data-key="' + CSS.escape(parts.slice(0, i).join(' > ')) + '"]');
        if (li) {
          const ul = li.querySelector(':scope > ul');
          const btn = li.querySelector(':scope > .tree-row .tree-toggle');
          if (ul) ul.hidden = false;
          if (btn) btn.setAttribute('aria-expanded', 'true');
        }
      }
    }
  }

  function chipGroup(name, items, selected, multi) {
    return '<div class="chips" role="group">' + items.map(it =>
      '<label class="chip"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + name + '" value="' + esc(String(it.value)) + '"' +
      (multi ? (selected.includes(it.value) ? ' checked' : '') : (selected === it.value ? ' checked' : '')) + '>' +
      '<span>' + esc(it.label) + (it.count != null ? ' <em>' + fmtNum(it.count) + '</em>' : '') + '</span></label>'
    ).join('') + '</div>';
  }

  function filterSections(crit, opts) {
    const pc = Store.poolCounts();
    const tree = Store.buildTree();
    const srcs = [...Store.sourceCounts().entries()].sort((a, b) => sourceLabel(a[0]).localeCompare(sourceLabel(b[0]), 'tr'));
    const diffs = [...Store.diffCounts().entries()].sort((a, b) => (a[0] || 9) - (b[0] || 9));
    const types = [...Store.typeCounts().entries()].sort((a, b) => typeLabel(a[0]).localeCompare(typeLabel(b[0]), 'tr'));
    let html = '';
    html += '<div class="fsec"><h3>Soru havuzu</h3>' + chipGroup('pool', [
      { value: 'all', label: 'Tüm sorular', count: pc.all },
      { value: 'wrong', label: 'Yanlış yaptıklarım', count: pc.wrong },
      { value: 'fav', label: 'Favorilerim', count: pc.fav },
      { value: 'unsolved', label: 'Hiç çözmediklerim', count: pc.unsolved }
    ], crit.pool, false) + '</div>';
    html += '<div class="fsec"><div class="fsec-head"><h3>Konular</h3><button type="button" class="link-btn" data-clear="topics">Temizle</button></div>' +
      '<p class="hint">Seçim yapmazsanız tüm konular dahil olur. Üst konu alt konuları da kapsar.</p>' +
      '<div class="tree-wrap" data-tree>' + topicTreeHTML(tree, { manage: !!opts.manage }) + '</div></div>';
    html += '<div class="fsec"><div class="fsec-head"><h3>Kaynaklar</h3><button type="button" class="link-btn" data-clear="sources">Temizle</button></div>' +
      '<div class="src-list">' + srcs.map(([n, c]) =>
        '<div class="src-row"><label class="check"><input type="checkbox" name="sources" value="' + esc(n) + '"' + (crit.sources.includes(n) ? ' checked' : '') + '>' +
        '<span>' + esc(sourceLabel(n)) + '</span></label><span class="count">' + fmtNum(c) + '</span>' +
        (opts.manage && n ? '<button type="button" class="mini-btn" data-rename-source="' + esc(n) + '" title="Kaynak adını değiştir" aria-label="' + esc(n) + ' kaynağını yeniden adlandır">' + ICON.edit + '</button>' : '') +
        (opts.manage ? '<button type="button" class="mini-btn del" data-delete-source="' + esc(n) + '" title="Bu kaynaktaki soruları sil" aria-label="' + esc(sourceLabel(n)) + ' kaynağındaki soruları sil">' + ICON.trash + '</button>' : '') +
        '</div>').join('') + '</div></div>';
    if (diffs.length > 1 || (diffs.length === 1 && diffs[0][0])) {
      html += '<div class="fsec"><h3>Zorluk</h3>' + chipGroup('diffs', diffs.map(([d, c]) => ({ value: d, label: d ? d + '/5' : 'Belirtilmemiş', count: c })), crit.diffs, true) + '</div>';
    }
    if (types.length > 1 || (types.length === 1 && types[0][0])) {
      html += '<div class="fsec"><h3>Soru tipi</h3>' + chipGroup('types', types.map(([t, c]) => ({ value: t, label: typeLabel(t), count: c })), crit.types, true) + '</div>';
    }
    return html;
  }

  function bindFilters(container, crit, onChange) {
    const tw = container.querySelector('[data-tree]');
    if (tw) bindTree(tw, () => crit.topics, sel => { crit.topics = sel; onChange(); });
    container.addEventListener('change', e => {
      const t = e.target;
      if (t.name === 'pool') { crit.pool = t.value; onChange(); }
      else if (t.name === 'sources') {
        crit.sources = [...container.querySelectorAll('input[name=sources]:checked')].map(i => i.value);
        onChange();
      } else if (t.name === 'diffs') {
        crit.diffs = [...container.querySelectorAll('input[name=diffs]:checked')].map(i => Number(i.value));
        onChange();
      } else if (t.name === 'types') {
        crit.types = [...container.querySelectorAll('input[name=types]:checked')].map(i => i.value);
        onChange();
      }
    });
    container.addEventListener('click', e => {
      const c = e.target.closest('[data-clear]');
      if (!c) return;
      if (c.dataset.clear === 'topics') { crit.topics = []; if (tw) syncTree(tw, []); }
      if (c.dataset.clear === 'sources') { crit.sources = []; container.querySelectorAll('input[name=sources]').forEach(i => { i.checked = false; }); }
      onChange();
    });
  }

  function critTitle(c, n) {
    const parts = [];
    if (c.pool === 'wrong') parts.push('Yanlışlarım');
    if (c.pool === 'fav') parts.push('Favoriler');
    if (c.pool === 'unsolved') parts.push('Çözülmemişler');
    if (c.topics && c.topics.length) parts.push(lastSeg(c.topics[0]) + (c.topics.length > 1 ? ' +' + (c.topics.length - 1) : ''));
    if (c.sources && c.sources.length) parts.push(sourceLabel(c.sources[0]) + (c.sources.length > 1 ? ' +' + (c.sources.length - 1) : ''));
    if (c.search) parts.push('“' + c.search + '”');
    if (!parts.length) parts.push('Karışık');
    return parts.join(' · ') + ' · ' + n + ' soru';
  }

  async function startTest(qids, title, criteria) {
    if (!qids.length) { toast('Bu seçimle eşleşen soru yok.', 'err'); return; }
    const t = await Store.createTest(qids, title, criteria);
    location.hash = '#/test/' + t.id;
  }

  async function quickStart(pool, count) {
    const c = Store.emptyCrit();
    c.pool = pool;
    const list = shuffle(Store.filter(c)).slice(0, count || 9999).map(q => q.id);
    await startTest(list, critTitle(c, list.length), c);
  }

  function testRow(t) {
    const st = Store.testStats(t);
    const done = !!t.finishedAt;
    const status = done
      ? '<span class="badge ok">Bitti · ' + pct(st.correct, st.total) + '</span>'
      : '<span class="badge warn">' + st.answered + '/' + st.total + ' cevaplandı</span>';
    return '<li class="test-row">' +
      '<a class="test-main" href="' + (done ? '#/sonuc/' + t.id : '#/test/' + t.id) + '">' +
      '<span class="test-title">' + esc(t.title) + '</span>' +
      '<span class="test-meta">' + status + '<span class="muted">' + relTime(t.updatedAt) + '</span></span></a>' +
      '<button type="button" class="mini-btn" data-del-test="' + t.id + '" title="Testi sil" aria-label="Testi sil">' + ICON.trash + '</button></li>';
  }

  function bindTestRows(container, rerender) {
    container.addEventListener('click', async e => {
      const b = e.target.closest('[data-del-test]');
      if (!b) return;
      e.preventDefault();
      const ok = await confirmBox('Test silinsin mi?', 'Bu test listeden kaldırılır. Çözüm geçmişiniz ve istatistikleriniz korunur.', 'Sil', true);
      if (!ok) return;
      await Store.deleteTest(b.dataset.delTest);
      toast('Test silindi');
      rerender();
    });
  }

  // ---------- Ana Sayfa ----------
  function viewHome() {
    const total = S.questions.size;
    const pc = Store.poolCounts();
    const solved = total - pc.unsolved;
    let attempts = 0, correct = 0;
    for (const a of S.attempts) { if (S.questions.has(a.qid)) { attempts++; if (a.correct) correct++; } }
    const tests = Store.testList();
    const open = tests.filter(t => !t.finishedAt && Store.testStats(t).total > 0);
    const done = tests.filter(t => t.finishedAt).slice(0, 5);
    const bs = backupStatus();

    let html = '<div class="page-head"><div><h1>Merhaba 👋</h1><p class="muted">KBB sorularını konuya, kaynağa göre ya da rastgele çöz.</p></div></div>';

    if (!total) {
      view.innerHTML = html + installCard() + emptyBank() + backupCard(bs);
      bindBackupCard();
      bindInstallCard();
      return;
    }

    html += '<div class="stats-grid">' +
      statCard('Toplam soru', fmtNum(total), fmtNum(Store.sourceCounts().size) + ' kaynak', '', '#/banka') +
      statCard('Çözülen soru', fmtNum(solved), pct(solved, total) + ' tamamlandı', '', '#/istatistik') +
      statCard('Doğru oranı', pct(correct, attempts), fmtNum(attempts) + ' çözüm', 'accent', '#/istatistik') +
      statCard('Yanlışlar', fmtNum(pc.wrong), pc.wrong ? 'Tekrar çözmek için dokun' : 'Harika, yanlış yok', pc.wrong ? 'danger' : '', null) +
      '</div>';

    if (open.length) {
      const t = open[0];
      const st = Store.testStats(t);
      html += '<section class="card continue">' +
        '<div><div class="eyebrow">Kaldığın yerden devam et</div>' +
        '<h2>' + esc(t.title) + '</h2>' +
        '<div class="progress"><span style="width:' + Math.round((st.answered / st.total) * 100) + '%"></span></div>' +
        '<p class="muted">' + st.answered + ' / ' + st.total + ' cevaplandı · ' + relTime(t.updatedAt) + '</p></div>' +
        '<a class="btn primary lg" href="#/test/' + t.id + '">' + ICON.play + 'Devam Et</a></section>';
    }

    html += '<section class="card"><h2 class="card-title">Hızlı başla</h2><div class="quick-grid">' +
      '<button type="button" class="quick" data-quick="all"><strong>Rastgele 20 soru</strong><span>Tüm bankadan karışık</span></button>' +
      '<button type="button" class="quick" data-quick="wrong"' + (pc.wrong ? '' : ' disabled') + '><strong>Yanlışlarımı çöz</strong><span>' + fmtNum(pc.wrong) + ' soru</span></button>' +
      '<button type="button" class="quick" data-quick="fav"' + (pc.fav ? '' : ' disabled') + '><strong>Favorilerim</strong><span>' + fmtNum(pc.fav) + ' soru</span></button>' +
      '<button type="button" class="quick" data-quick="unsolved"' + (pc.unsolved ? '' : ' disabled') + '><strong>Hiç çözmediklerim</strong><span>' + fmtNum(pc.unsolved) + ' soru</span></button>' +
      '<a class="quick primary" href="#/test"><strong>Özel test oluştur</strong><span>Konu, kaynak, zorluk seç</span></a>' +
      '</div></section>';

    if (open.length > 1) {
      html += '<section class="card"><h2 class="card-title">Yarım kalan testler</h2><ul class="test-list" data-tests>' + open.slice(1, 6).map(testRow).join('') + '</ul></section>';
    }
    if (done.length) {
      html += '<section class="card"><div class="card-head"><h2 class="card-title">Son testler</h2><a class="link" href="#/test">Tümü</a></div><ul class="test-list" data-tests>' + done.map(testRow).join('') + '</ul></section>';
    }
    html += installCard();
    html += backupCard(bs);
    view.innerHTML = html;
    bindInstallCard();

    view.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => {
      const p = b.dataset.quick;
      quickStart(p, p === 'all' ? 20 : 50);
    }));
    const wrongCard = view.querySelector('.stat.danger');
    if (wrongCard) {
      wrongCard.setAttribute('role', 'button');
      wrongCard.tabIndex = 0;
      const go = () => quickStart('wrong', 50);
      wrongCard.addEventListener('click', go);
      wrongCard.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    }
    view.querySelectorAll('[data-tests]').forEach(el => bindTestRows(el, viewHome));
    bindBackupCard();
  }

  function backupCard(bs) {
    return '<section class="card backup-card' + (bs.needed ? ' attention' : '') + '">' +
      '<div class="backup-icon">' + ICON.shield + '</div>' +
      '<div class="backup-text"><h2 class="card-title">Yedekleme</h2>' +
      '<p>Sorular ve çözüm geçmişi yalnızca <strong>bu tarayıcıda</strong> saklanır. Tarayıcı verileri silinirse kaybolabilir; düzenli yedek alın.</p>' +
      '<p class="muted small">' + esc(bs.text) + '</p></div>' +
      '<div class="backup-actions">' +
      (S.questions.size ? '<button type="button" class="btn primary" data-backup-dl>' + ICON.download + 'Yedek İndir</button>' : '') +
      '<a class="btn ghost" href="#/yukle?yedek">Yedeği Yükle</a></div></section>';
  }

  function bindBackupCard() {
    const b = view.querySelector('[data-backup-dl]');
    if (b) b.addEventListener('click', () => { downloadBackup(); setTimeout(route, 50); });
  }

  // ---------- Test oluşturma ----------
  function viewBuilder() {
    if (!S.questions.size) { view.innerHTML = '<div class="page-head"><h1>Test Çöz</h1></div>' + emptyBank(); return; }
    const B = Object.assign({ count: 20, custom: '', shuffle: true }, Store.emptyCrit(), lsGet('kbb.builder', {}));
    B.search = '';
    // Artık var olmayan seçimleri temizle
    const srcNames = Store.sourceCounts();
    B.sources = (B.sources || []).filter(n => srcNames.has(n));
    B.topics = (B.topics || []).filter(k => Store.sorted().some(q => Store.inTopic(q.topic, k)));

    const tests = Store.testList();
    const open = tests.filter(t => !t.finishedAt && Store.testStats(t).total > 0);
    const done = tests.filter(t => t.finishedAt);

    let html = '<div class="page-head"><div><h1>Test Çöz</h1><p class="muted">Filtreleri seç, soru sayısını belirle ve başla.</p></div></div>';
    if (open.length) html += '<section class="card"><h2 class="card-title">Yarım kalan testler</h2><ul class="test-list" data-tests>' + open.map(testRow).join('') + '</ul></section>';
    html += '<section class="card builder"><h2 class="card-title">Yeni test</h2><div class="filters" data-filters>' + filterSections(B, {}) + '</div>' +
      '<div class="fsec"><h3>Soru sayısı</h3><div class="count-row">' +
      chipGroup('count', [10, 20, 30, 50].map(n => ({ value: n, label: String(n) })).concat([{ value: 'all', label: 'Tümü' }, { value: 'custom', label: 'Özel' }]), B.count, false) +
      '<input type="number" class="input custom-count" min="1" max="9999" inputmode="numeric" placeholder="Sayı" aria-label="Özel soru sayısı" value="' + esc(B.custom) + '"' + (B.count === 'custom' ? '' : ' hidden') + '>' +
      '</div></div>' +
      '<div class="fsec"><label class="switch"><input type="checkbox" name="shuffle"' + (B.shuffle ? ' checked' : '') + '><span class="track"></span><span>Soruları rastgele karıştır</span></label></div>' +
      '<div class="builder-foot"><div class="match" aria-live="polite"></div><button type="button" class="btn primary lg" data-start>' + ICON.play + 'Testi Başlat</button></div>' +
      '</section>';
    if (done.length) {
      html += '<section class="card"><h2 class="card-title">Geçmiş testler</h2><ul class="test-list" data-tests>' + done.slice(0, 20).map(testRow).join('') + '</ul>' +
        (done.length > 20 ? '<p class="muted small">Son 20 test gösteriliyor.</p>' : '') + '</section>';
    }
    view.innerHTML = html;

    const matchEl = view.querySelector('.match');
    const customEl = view.querySelector('.custom-count');
    const startBtn = view.querySelector('[data-start]');
    const wanted = () => {
      if (B.count === 'all') return Infinity;
      if (B.count === 'custom') { const n = parseInt(B.custom, 10); return n > 0 ? n : 0; }
      return Number(B.count);
    };
    const update = () => {
      lsSet('kbb.builder', B);
      const n = Store.filter(B).length;
      const w = wanted();
      let msg = '<strong>' + fmtNum(n) + '</strong> soru eşleşiyor';
      if (!n) msg = '<span class="err-text">Bu filtreyle eşleşen soru yok.</span>';
      else if (B.count === 'custom' && !w) msg += ' · <span class="warn-text">Soru sayısı girin.</span>';
      else if (w !== Infinity && w > n) msg += ' · <span class="warn-text">İstenen ' + w + ', test ' + n + ' soruyla oluşturulacak.</span>';
      else msg += ' · test <strong>' + fmtNum(Math.min(w, n)) + '</strong> soru';
      matchEl.innerHTML = msg;
      startBtn.disabled = !n || (B.count === 'custom' && !w);
    };
    bindFilters(view.querySelector('[data-filters]'), B, update);
    view.querySelector('.builder').addEventListener('change', e => {
      const t = e.target;
      if (t.name === 'count') {
        B.count = t.value === 'all' || t.value === 'custom' ? t.value : Number(t.value);
        customEl.hidden = B.count !== 'custom';
        if (B.count === 'custom') customEl.focus();
        update();
      } else if (t.name === 'shuffle') { B.shuffle = t.checked; update(); }
    });
    customEl.addEventListener('input', () => { B.custom = customEl.value; update(); });
    startBtn.addEventListener('click', () => {
      let list = Store.filter(B);
      if (B.shuffle) list = shuffle(list);
      const w = wanted();
      list = list.slice(0, w === Infinity ? list.length : w).map(q => q.id);
      const crit = { pool: B.pool, topics: B.topics, sources: B.sources, diffs: B.diffs, types: B.types, search: '' };
      startTest(list, critTitle(crit, list.length), crit);
    });
    view.querySelectorAll('[data-tests]').forEach(el => bindTestRows(el, viewBuilder));
    update();
  }

  // ---------- Soru çözme ----------
  let keyHandler = null;

  function questionMeta(q, revealed) {
    const chips = ['<span class="chip-static topic">' + esc(q.topic) + '</span>'];
    if (q.difficulty) chips.push('<span class="chip-static diff d' + q.difficulty + '" title="Zorluk">Zorluk ' + q.difficulty + '/5</span>');
    if (q.type) chips.push('<span class="chip-static">' + esc(q.type) + '</span>');
    if (revealed && q.related && q.related.length) chips.push(...q.related.map(r => '<span class="chip-static tag">#' + esc(r) + '</span>'));
    return '<div class="q-meta">' + chips.join('') + '</div>';
  }

  function viewSolve(id) {
    const t = S.tests.get(id);
    if (!t) {
      view.innerHTML = '<section class="card empty"><h2>Test bulunamadı</h2><p>Bu test silinmiş olabilir.</p><a class="btn primary" href="#/test">Test Çöz</a></section>';
      return;
    }
    const qids = t.qids.filter(x => S.questions.has(x));
    if (!qids.length) {
      view.innerHTML = '<section class="card empty"><h2>Bu testteki sorular artık bankada yok</h2><a class="btn primary" href="#/test">Yeni Test</a></section>';
      return;
    }
    if (t.index >= qids.length) t.index = qids.length - 1;
    if (t.index < 0) t.index = 0;

    const go = async (i, swiped) => {
      if (i < 0 || i >= qids.length || i === t.index) {
        if (swiped) bump(i < 0 ? 'right' : 'left');
        return;
      }
      const dir = i > t.index ? 'next' : 'prev';
      t.index = i;
      render();
      const card = view.querySelector('.qcard');
      if (card && !reduceMotion()) card.classList.add('enter-' + dir);
      window.scrollTo({ top: 0 });
      await Store.saveTest(t);
    };

    const finish = async () => {
      const st = Store.testStats(t);
      const blankSel = qids.filter(x => !t.answers[x] && t.selections[x]).length;
      if (st.blank) {
        let msg = st.blank + ' soru cevaplanmadı. Testi bitirirsen bunlar boş sayılır.';
        if (blankSel) msg += ' (' + blankSel + ' soruda şık seçili ama kontrol edilmedi.)';
        const ok = await confirmBox('Test bitirilsin mi?', msg, 'Testi Bitir');
        if (!ok) return;
      }
      t.finishedAt = Date.now();
      await Store.saveTest(t);
      location.hash = '#/sonuc/' + t.id;
    };

    const check = async () => {
      const qid = qids[t.index];
      const choice = t.selections[qid];
      if (!choice || t.answers[qid] || t.finishedAt) return;
      await Store.recordAnswer(t, qid, choice);
      render();
      const fb = view.querySelector('.feedback');
      if (fb && fb.getBoundingClientRect().top > window.innerHeight - 120) fb.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const select = async L => {
      const qid = qids[t.index];
      if (t.answers[qid] || t.finishedAt) return;
      t.selections[qid] = L;
      render();
      await Store.saveTest(t);
    };

    function render() {
      const qid = qids[t.index];
      const q = S.questions.get(qid);
      const ans = t.answers[qid];
      const finished = !!t.finishedAt;
      const revealed = !!ans || finished;
      const sel = ans ? ans.choice : t.selections[qid];
      const st = Store.testStats(t);
      const fav = S.favorites.has(qid);
      const isLast = t.index === qids.length - 1;

      let opts = '';
      for (const L of LETTERS) {
        let cls = 'option';
        if (sel === L) cls += ' selected';
        if (revealed) {
          cls += ' locked';
          if (L === q.answer) cls += ' correct';
          else if (ans && ans.choice === L) cls += ' wrong';
          else cls += ' dim';
        }
        opts += '<button type="button" class="' + cls + '" data-opt="' + L + '"' + (revealed ? ' aria-disabled="true"' : '') + ' aria-pressed="' + (sel === L) + '">' +
          '<span class="opt-letter">' + L + '</span><span class="opt-text md">' + md(q.options[L]) + '</span>' +
          (revealed && L === q.answer ? '<span class="opt-mark ok">' + ICON.check + '</span>' : '') +
          (revealed && ans && ans.choice === L && !ans.correct ? '<span class="opt-mark bad">' + ICON.x + '</span>' : '') +
          '</button>';
      }

      let feedback = '';
      if (revealed) {
        let head;
        if (ans && ans.correct) head = '<div class="fb-head ok">' + ICON.check + '<span>Doğru!</span></div>';
        else if (ans) head = '<div class="fb-head bad">' + ICON.x + '<span>Yanlış. Doğru cevap: <strong>' + q.answer + '</strong></span></div>';
        else head = '<div class="fb-head neutral"><span>Boş bırakıldı. Doğru cevap: <strong>' + q.answer + '</strong></span></div>';
        feedback = '<section class="feedback">' + head +
          (q.explanation ? '<div class="expl"><h3>Açıklama</h3><div class="md">' + md(q.explanation) + '</div></div>' : '') +
          '</section>';
      }

      const nav = qids.map((x, i) => {
        const a = t.answers[x];
        let c = 'nav-dot';
        if (a) c += a.correct ? ' ok' : ' bad';
        else if (t.selections[x]) c += ' sel';
        if (i === t.index) c += ' current';
        return '<button type="button" class="' + c + '" data-go="' + i + '" aria-label="Soru ' + (i + 1) + '">' + (i + 1) + '</button>';
      }).join('');

      let primary;
      if (!revealed) primary = '<button type="button" class="btn primary lg" data-check' + (sel ? '' : ' disabled') + '>Kontrol Et</button>';
      else if (!isLast) primary = '<button type="button" class="btn primary lg" data-next>Sonraki Soru' + ICON.right + '</button>';
      else if (!finished) primary = '<button type="button" class="btn primary lg" data-finish>Testi Bitir</button>';
      else primary = '<a class="btn primary lg" href="#/sonuc/' + t.id + '">Sonuçlar</a>';

      const src = sourcesText(q);
      view.innerHTML =
        '<div class="solve">' +
        '<div class="solve-head">' +
        '<a class="back" href="#/test" aria-label="Testlere dön" title="Testlere dön">' + ICON.left + '</a>' +
        '<div class="solve-info">' +
        '<h1 class="solve-title" title="' + esc(t.title) + '">' + (finished ? 'İnceleme · ' : '') + esc(t.title) + '</h1>' +
        '<div class="solve-progress"><span class="counter"><strong>' + (t.index + 1) + '</strong>/' + qids.length + '</span>' +
        '<div class="progress" role="progressbar" aria-label="Cevaplanan" aria-valuemin="0" aria-valuemax="' + qids.length + '" aria-valuenow="' + st.answered + '"><span style="width:' + Math.round((st.answered / qids.length) * 100) + '%"></span></div>' +
        '<span class="score"><span class="ok-text" title="Doğru">' + st.correct + '✓</span><span class="err-text" title="Yanlış">' + st.wrong + '✗</span></span></div>' +
        '</div>' +
        '<button type="button" class="fav-btn' + (fav ? ' on' : '') + '" data-fav aria-pressed="' + fav + '" title="' + (fav ? 'Favorilerden çıkar' : 'Favoriye ekle') + '" aria-label="' + (fav ? 'Favorilerden çıkar' : 'Favoriye ekle') + '">' + ICON.star + '<span>' + (fav ? 'Favoride' : 'Favori') + '</span></button>' +
        (finished ? '<a class="btn ghost sm" href="#/sonuc/' + t.id + '">Sonuçlar</a>' : '<button type="button" class="btn ghost sm" data-finish>Bitir</button>') +
        '</div>' +
        '<article class="card qcard">' +
        '<div class="qcard-top">' + questionMeta(q, revealed) + '</div>' +
        '<div class="stem md">' + md(q.stem) + '</div>' +
        '<div class="options">' + opts + '</div>' +
        feedback +
        (src ? '<footer class="q-source">' + ICON.file + '<span>Kaynak: ' + esc(src) + '</span></footer>' : '') +
        '</article>' +
        '<div class="solve-actions">' +
        '<button type="button" class="btn ghost lg" data-prev' + (t.index === 0 ? ' disabled' : '') + '>' + ICON.left + '<span class="hide-xs">Önceki</span></button>' +
        primary +
        '<button type="button" class="btn ghost lg" data-skip' + (isLast ? ' disabled' : '') + ' title="Sonraki soru"><span class="hide-xs">Sonraki</span>' + ICON.right + '</button>' +
        '</div>' +
        '<details class="card navigator"><summary>Soru listesi <span class="muted">(' + st.answered + ' cevaplandı)</span></summary><div class="nav-grid">' + nav + '</div></details>' +
        '<p class="kbd-hint muted small hide-touch">Kısayollar: A–E veya 1–5 şık seç · Enter kontrol/sonraki · ← → gezin · F favori</p>' +
        '<p class="kbd-hint muted small touch-only">Sorular arasında geçmek için sola/sağa kaydırın.</p>' +
        '</div>';
      const navEl = view.querySelector('.navigator');
      if (lsGet('kbb.navOpen', false)) navEl.open = true;
      navEl.addEventListener('toggle', () => lsSet('kbb.navOpen', navEl.open));
    }

    view.onclick = async e => {
      const o = e.target.closest('[data-opt]');
      if (o) { select(o.dataset.opt); return; }
      if (e.target.closest('[data-check]')) { check(); return; }
      if (e.target.closest('[data-next]') || e.target.closest('[data-skip]')) { go(t.index + 1); return; }
      if (e.target.closest('[data-prev]')) { go(t.index - 1); return; }
      if (e.target.closest('[data-finish]')) { finish(); return; }
      const g = e.target.closest('[data-go]');
      if (g) { go(Number(g.dataset.go)); return; }
      if (e.target.closest('[data-fav]')) {
        const on = await Store.toggleFavorite(qids[t.index]);
        toast(on ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı');
        render();
      }
    };

    // Kaydırma (swipe): sola → sonraki, sağa → önceki
    function bump(side) {
      const card = view.querySelector('.qcard');
      if (!card || reduceMotion()) return;
      card.classList.remove('bump-left', 'bump-right');
      void card.offsetWidth;
      card.classList.add('bump-' + side);
    }
    let sw = null;
    view.ontouchstart = e => {
      if (e.touches.length !== 1 || modalOpen) { sw = null; return; }
      const el = e.target;
      // yatay kayan tablo/kod alanlarında ve gezinme listesinde swipe yok
      if (el.closest && el.closest('.table-wrap, pre, .q-meta, .navigator, .solve-actions')) { sw = null; return; }
      const p = e.touches[0];
      sw = { x: p.clientX, y: p.clientY, t: Date.now(), card: view.querySelector('.qcard'), moved: false, horiz: null };
    };
    view.ontouchmove = e => {
      if (!sw || !sw.card) return;
      const p = e.touches[0];
      const dx = p.clientX - sw.x, dy = p.clientY - sw.y;
      if (sw.horiz === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) sw.horiz = Math.abs(dx) > Math.abs(dy) * 1.3;
      if (!sw.horiz) return;
      sw.moved = true;
      if (!reduceMotion()) {
        const edge = (dx > 0 && t.index === 0) || (dx < 0 && t.index === qids.length - 1);
        sw.card.style.transition = 'none';
        sw.card.style.transform = 'translateX(' + (edge ? dx * 0.25 : dx * 0.6) + 'px)';
        sw.card.style.opacity = String(Math.max(0.55, 1 - Math.abs(dx) / 700));
      }
    };
    view.ontouchend = view.ontouchcancel = e => {
      if (!sw) return;
      const s0 = sw; sw = null;
      if (s0.card) { s0.card.style.transition = ''; s0.card.style.transform = ''; s0.card.style.opacity = ''; }
      if (!s0.horiz || e.type === 'touchcancel') return;
      const sel = window.getSelection && String(window.getSelection());
      if (sel) return;
      const p = e.changedTouches[0];
      const dx = p.clientX - s0.x, dy = p.clientY - s0.y;
      const fast = Date.now() - s0.t < 300 && Math.abs(dx) > 35;
      if ((Math.abs(dx) > 70 || fast) && Math.abs(dx) > Math.abs(dy) * 1.3) {
        go(t.index + (dx < 0 ? 1 : -1), true);
      }
    };

    keyHandler = e => {
      if (modalOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) return;
      const k = e.key.toUpperCase();
      const idx = '12345'.indexOf(e.key);
      if (LETTERS.includes(k) || idx >= 0) { e.preventDefault(); select(LETTERS.includes(k) ? k : LETTERS[idx]); }
      else if (e.key === 'Enter') {
        if (document.activeElement && document.activeElement.closest && document.activeElement.closest('button, a, summary')) {
          if (!document.activeElement.closest('[data-opt]')) return;
        }
        e.preventDefault();
        const qid = qids[t.index];
        if (!t.answers[qid] && !t.finishedAt) check();
        else if (t.index < qids.length - 1) go(t.index + 1);
        else if (!t.finishedAt) finish();
      } else if (e.key === 'ArrowRight') go(t.index + 1);
      else if (e.key === 'ArrowLeft') go(t.index - 1);
      else if (k === 'F') view.querySelector('[data-fav]').click();
    };

    render();
  }

  // ---------- Sonuç ----------
  function viewResult(id) {
    const t = S.tests.get(id);
    if (!t) { location.hash = '#/test'; return; }
    const st = Store.testStats(t);
    const rate = st.total ? Math.round((st.correct / st.total) * 100) : 0;
    const wrongIds = st.qids.filter(x => t.answers[x] && !t.answers[x].correct);
    const blankIds = st.qids.filter(x => !t.answers[x]);

    // Konu kırılımı
    const byTopic = new Map();
    for (const x of st.qids) {
      const q = S.questions.get(x);
      const k = q.topic.split(' > ').slice(0, 2).join(' > ');
      const r = byTopic.get(k) || { n: 0, c: 0 };
      r.n++;
      if (t.answers[x] && t.answers[x].correct) r.c++;
      byTopic.set(k, r);
    }

    let html = '<div class="page-head"><div><div class="eyebrow">Test sonucu</div><h1>' + esc(t.title) + '</h1>' +
      '<p class="muted">' + (t.finishedAt ? 'Bitirildi: ' + fmtDate(t.finishedAt) : 'Henüz bitirilmedi') + '</p></div></div>';
    html += '<section class="card result-hero">' +
      '<div class="ring" style="--p:' + rate + '"><div><strong>%' + rate + '</strong><span>başarı</span></div></div>' +
      '<div class="result-stats">' +
      '<div class="rs ok"><strong>' + st.correct + '</strong><span>Doğru</span></div>' +
      '<div class="rs bad"><strong>' + st.wrong + '</strong><span>Yanlış</span></div>' +
      '<div class="rs"><strong>' + st.blank + '</strong><span>Boş</span></div>' +
      '<div class="rs"><strong>' + st.total + '</strong><span>Toplam</span></div>' +
      '</div>' +
      '<p class="muted small center">Cevaplananlarda doğru oranı: ' + pct(st.correct, st.answered) + '</p>' +
      '<div class="row center wrap">' +
      (wrongIds.length ? '<button type="button" class="btn danger-soft lg" data-retry="wrong">Yanlışları Tekrar Çöz (' + wrongIds.length + ')</button>' : '') +
      (blankIds.length && t.finishedAt ? '<button type="button" class="btn ghost lg" data-retry="blank">Boşları Çöz (' + blankIds.length + ')</button>' : '') +
      '<a class="btn ghost lg" href="#/test/' + t.id + '">' + (t.finishedAt ? 'Soruları İncele' : 'Teste Dön') + '</a>' +
      '<a class="btn primary lg" href="#/test">Yeni Test</a>' +
      '</div></section>';

    if (byTopic.size > 1) {
      html += '<section class="card"><h2 class="card-title">Konulara göre</h2><div class="bars">' +
        [...byTopic.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, r]) =>
          '<div class="bar-row"><span class="bar-label">' + esc(k) + '</span><span class="bar"><span style="width:' + Math.round((r.c / r.n) * 100) + '%"></span></span><span class="bar-val">' + r.c + '/' + r.n + '</span></div>'
        ).join('') + '</div></section>';
    }

    html += '<section class="card"><h2 class="card-title">Sorular</h2><ol class="result-list">' + st.qids.map((x, i) => {
      const q = S.questions.get(x);
      const a = t.answers[x];
      const cls = a ? (a.correct ? 'ok' : 'bad') : 'blank';
      const label = a ? (a.correct ? 'Doğru' : 'Yanlış (' + a.choice + ' → ' + q.answer + ')') : 'Boş (' + q.answer + ')';
      return '<li><button type="button" class="result-item ' + cls + '" data-open="' + i + '"><span class="ri-num">' + (i + 1) + '</span>' +
        '<span class="ri-text">' + esc(MD.plain(q.stem, 140)) + '</span><span class="ri-status">' + esc(label) + '</span></button></li>';
    }).join('') + '</ol></section>';
    view.innerHTML = html;

    view.onclick = async e => {
      const r = e.target.closest('[data-retry]');
      if (r) {
        const ids = r.dataset.retry === 'wrong' ? wrongIds : blankIds;
        const base = t.title.replace(/ · \d+ soru$/, '');
        await startTest(ids, base + ' · ' + (r.dataset.retry === 'wrong' ? 'Yanlışlar' : 'Boşlar') + ' · ' + ids.length + ' soru', t.criteria);
        return;
      }
      const o = e.target.closest('[data-open]');
      if (o) {
        t.index = Number(o.dataset.open);
        await Store.saveTest(t);
        location.hash = '#/test/' + t.id;
      }
    };
  }

  // ---------- Soru Bankası ----------
  const BANK_PAGE = 30;
  let bankState = null;

  function viewBank() {
    if (!S.questions.size) { view.innerHTML = '<div class="page-head"><h1>Soru Bankası</h1></div>' + emptyBank(); return; }
    if (!bankState) bankState = Object.assign(Store.emptyCrit(), lsGet('kbb.bank', {}), { search: '' });
    const C = bankState;
    const srcNames = Store.sourceCounts();
    C.sources = (C.sources || []).filter(n => srcNames.has(n));
    C.topics = (C.topics || []).filter(k => Store.sorted().some(q => Store.inTopic(q.topic, k)));
    let shown = BANK_PAGE;
    const expanded = new Set();
    let selecting = false;
    const selected = new Set();

    view.innerHTML =
      '<div class="page-head"><div><h1>Soru Bankası</h1><p class="muted">' + fmtNum(S.questions.size) + ' soru · konuya, kaynağa göre filtrele, ara, düzenle.</p></div></div>' +
      '<div class="bank">' +
      '<aside class="bank-side card"><details class="filters-toggle" open><summary>Filtreler <span class="fcount"></span></summary>' +
      '<div class="filters" data-filters>' + filterSections(C, { manage: true }) + '</div></details></aside>' +
      '<section class="bank-main">' +
      '<div class="search-row"><input type="search" class="input search" placeholder="Soru, şık, açıklama, konu veya kaynakta ara…" aria-label="Arama" value="' + esc(C.search) + '"></div>' +
      '<div class="bank-bar"><span class="result-count" aria-live="polite"></span><div class="row wrap">' +
      '<button type="button" class="btn ghost sm" data-select-mode>' + ICON.check + 'Seç</button>' +
      '<button type="button" class="btn primary sm" data-test-from>' + ICON.play + 'Bu sorularla test</button></div></div>' +
      '<div class="select-bar" hidden><label class="check"><input type="checkbox" data-select-all><span class="sel-all-label"></span></label>' +
      '<span class="sel-count" aria-live="polite"></span>' +
      '<div class="row wrap"><button type="button" class="btn danger sm" data-delete-selected>' + ICON.trash + 'Seçilenleri Sil</button>' +
      '<button type="button" class="btn ghost sm" data-select-done>Bitti</button></div></div>' +
      '<ul class="qlist"></ul><div class="more-wrap"></div></section></div>';

    const ft = view.querySelector('.filters-toggle');
    if (window.matchMedia('(max-width: 900px)').matches) ft.open = false;
    const listEl = view.querySelector('.qlist');
    const moreEl = view.querySelector('.more-wrap');
    const countEl = view.querySelector('.result-count');
    const fcount = view.querySelector('.fcount');
    const selBar = view.querySelector('.select-bar');
    const selAll = view.querySelector('[data-select-all]');
    let results = [];

    function syncSelectBar() {
      selBar.hidden = !selecting;
      view.querySelector('.bank-bar').hidden = selecting;
      if (!selecting) return;
      const n = selected.size;
      view.querySelector('.sel-all-label').textContent = 'Filtrelenen tümünü seç (' + fmtNum(results.length) + ')';
      view.querySelector('.sel-count').textContent = fmtNum(n) + ' seçili';
      selAll.checked = n > 0 && n === results.length;
      selAll.indeterminate = n > 0 && n < results.length;
      selAll.disabled = !results.length;
      view.querySelector('[data-delete-selected]').disabled = !n;
    }

    function itemHTML(q) {
      const p = S.progress.get(q.id);
      const fav = S.favorites.has(q.id);
      const open = expanded.has(q.id);
      let status = '<span class="badge">Çözülmedi</span>';
      if (p) status = p.last ? '<span class="badge ok">Son: doğru</span>' : '<span class="badge bad">Son: yanlış</span>';
      let body = '';
      if (open) {
        body = '<div class="qi-body">' +
          '<div class="stem md">' + md(q.stem) + '</div>' +
          '<ol class="qi-opts">' + LETTERS.map(L => '<li class="' + (L === q.answer ? 'correct' : '') + '"><span class="opt-letter">' + L + '</span><div class="md">' + md(q.options[L]) + '</div></li>').join('') + '</ol>' +
          (q.explanation ? '<div class="expl"><h3>Açıklama</h3><div class="md">' + md(q.explanation) + '</div></div>' : '') +
          '<dl class="qi-info">' +
          '<dt>Konu</dt><dd>' + esc(q.topic) + '</dd>' +
          (q.related && q.related.length ? '<dt>İlişkili</dt><dd>' + esc(q.related.join(', ')) + '</dd>' : '') +
          (q.type ? '<dt>Tip</dt><dd>' + esc(q.type) + '</dd>' : '') +
          (q.difficulty ? '<dt>Zorluk</dt><dd>' + q.difficulty + '/5</dd>' : '') +
          '<dt>Kaynak</dt><dd>' + (q.sources.length ? q.sources.map(s => esc(s.name + (s.page ? ' · ' + s.page : ''))).join('<br>') : 'Belirtilmemiş') + '</dd>' +
          (q.files && q.files.length ? '<dt>Dosya</dt><dd>' + esc(q.files.join(', ')) + '</dd>' : '') +
          '<dt>Geçmiş</dt><dd>' + (p ? p.n + ' çözüm · ' + p.correct + ' doğru · son ' + relTime(p.lastAt) : 'Henüz çözülmedi') + '</dd>' +
          '</dl>' +
          '<div class="row wrap">' +
          '<button type="button" class="btn ghost sm" data-edit="' + q.id + '">' + ICON.edit + 'Düzenle</button>' +
          '<button type="button" class="btn danger-soft sm" data-delete="' + q.id + '">' + ICON.trash + 'Sil</button>' +
          '</div></div>';
      }
      const sel = selected.has(q.id);
      return '<li class="qitem' + (open ? ' open' : '') + (sel ? ' selected' : '') + '" data-id="' + q.id + '">' +
        '<div class="qi-head">' +
        (selecting ? '<label class="qi-check" title="Seç"><input type="checkbox" data-pick="' + q.id + '"' + (sel ? ' checked' : '') + ' aria-label="Soruyu seç"></label>' : '') +
        '<button type="button" class="qi-toggle" data-toggle="' + q.id + '" aria-expanded="' + open + '">' +
        '<span class="qi-topic">' + esc(q.topic) + '</span>' +
        '<span class="qi-stem">' + esc(MD.plain(q.stem, 220)) + '</span>' +
        '<span class="qi-meta">' + status +
        (q.difficulty ? '<span class="badge">Zorluk ' + q.difficulty + '</span>' : '') +
        (q.sources.length ? '<span class="badge src">' + esc(q.sources[0].name) + (q.sources.length > 1 ? ' +' + (q.sources.length - 1) : '') + '</span>' : '') +
        '</span></button>' +
        '<button type="button" class="fav-btn icon-only' + (fav ? ' on' : '') + '" data-fav="' + q.id + '" aria-pressed="' + fav + '" title="' + (fav ? 'Favorilerden çıkar' : 'Favoriye ekle') + '" aria-label="Favori">' + ICON.star + '</button>' +
        '</div>' + body + '</li>';
    }

    function renderList() {
      results = Store.filter(C);
      if (selected.size) {
        const vis = new Set(results.map(q => q.id));
        for (const id of [...selected]) if (!vis.has(id)) selected.delete(id);
      }
      syncSelectBar();
      const active = (C.pool !== 'all' ? 1 : 0) + C.topics.length + C.sources.length + C.diffs.length + C.types.length;
      fcount.textContent = active ? '(' + active + ')' : '';
      countEl.innerHTML = '<strong>' + fmtNum(results.length) + '</strong> soru';
      if (!results.length) {
        listEl.innerHTML = '<li class="empty-list">Bu filtreyle eşleşen soru yok.</li>';
        moreEl.innerHTML = '';
        return;
      }
      listEl.innerHTML = results.slice(0, shown).map(itemHTML).join('');
      moreEl.innerHTML = results.length > shown
        ? '<button type="button" class="btn ghost" data-more>Daha fazla göster (' + fmtNum(results.length - shown) + ' kaldı)</button>' : '';
    }

    function rerenderItem(id) {
      const li = listEl.querySelector('li[data-id="' + id + '"]');
      const q = S.questions.get(id);
      if (li && q) li.outerHTML = itemHTML(q);
      else renderList();
    }

    const changed = () => { shown = BANK_PAGE; lsSet('kbb.bank', Object.assign({}, C, { search: '' })); renderList(); };
    const filtersEl = view.querySelector('[data-filters]');
    bindFilters(filtersEl, C, changed);

    let timer;
    view.querySelector('.search').addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => { C.search = e.target.value; changed(); }, 180);
    });

    view.onchange = e => {
      const t = e.target;
      if (t.matches('[data-pick]')) {
        if (t.checked) selected.add(t.dataset.pick); else selected.delete(t.dataset.pick);
        t.closest('.qitem').classList.toggle('selected', t.checked);
        syncSelectBar();
      } else if (t.matches('[data-select-all]')) {
        if (t.checked) for (const q of results) selected.add(q.id); else selected.clear();
        renderList();
      }
    };

    const setSelecting = on => { selecting = on; selected.clear(); renderList(); };

    view.onclick = async e => {
      let b;
      if (e.target.closest('[data-select-mode]')) { setSelecting(true); return; }
      if (e.target.closest('[data-select-done]')) { setSelecting(false); return; }
      if (e.target.closest('[data-delete-selected]')) {
        const ids = [...selected];
        if (!ids.length) return;
        const go = await confirmDelete(fmtNum(ids.length) + ' soru silinsin mi?',
          'Seçilen ' + fmtNum(ids.length) + ' soru, favori kayıtları ve çözüm geçmişiyle birlikte kalıcı olarak silinecek.');
        if (!go) return;
        const n = await Store.deleteQuestions(ids);
        toast(fmtNum(n) + ' soru silindi', 'ok');
        viewBank();
        return;
      }
      if ((b = e.target.closest('[data-delete-source]'))) {
        e.preventDefault();
        if (await deleteSourceDialog(b.dataset.deleteSource)) viewBank();
        return;
      }
      if ((b = e.target.closest('[data-toggle]'))) {
        const id = b.dataset.toggle;
        if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
        rerenderItem(id);
      } else if ((b = e.target.closest('[data-fav]'))) {
        const on = await Store.toggleFavorite(b.dataset.fav);
        toast(on ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı');
        rerenderItem(b.dataset.fav);
      } else if (e.target.closest('[data-more]')) {
        shown += BANK_PAGE * 2;
        renderList();
      } else if ((b = e.target.closest('[data-edit]'))) {
        const saved = await editQuestion(b.dataset.edit);
        if (saved) { rerenderItem(b.dataset.edit); toast('Soru kaydedildi', 'ok'); }
      } else if ((b = e.target.closest('[data-delete]'))) {
        const ok = await confirmBox('Soru silinsin mi?', 'Bu soru, favori kaydı ve çözüm geçmişi kalıcı olarak silinir. Bu işlem geri alınamaz (yedeğiniz varsa oradan geri yükleyebilirsiniz).', 'Sil', true);
        if (!ok) return;
        await Store.deleteQuestion(b.dataset.delete);
        toast('Soru silindi');
        viewBank();
      } else if ((b = e.target.closest('[data-rename-topic]'))) {
        e.preventDefault();
        const done = await renameTopicDialog(b.dataset.renameTopic);
        if (done) viewBank();
      } else if ((b = e.target.closest('[data-rename-source]'))) {
        e.preventDefault();
        const done = await renameSourceDialog(b.dataset.renameSource);
        if (done) viewBank();
      } else if (e.target.closest('[data-test-from]')) {
        if (!results.length) { toast('Eşleşen soru yok.', 'err'); return; }
        const list = shuffle(results).map(q => q.id);
        await startTest(list, critTitle(C, list.length), Object.assign({}, C));
      }
    };
    renderList();
  }

  async function renameTopicDialog(key) {
    const count = Store.sorted().filter(q => Store.inTopic(q.topic, key)).length;
    const all = new Set();
    for (const q of S.questions.values()) {
      const parts = q.topic.split(' > ');
      for (let i = 1; i <= parts.length; i++) all.add(parts.slice(0, i).join(' > '));
    }
    let result = false;
    await modal({
      title: 'Konuyu yeniden adlandır',
      body: '<p class="muted small">“' + esc(key) + '” ve alt konuları (' + fmtNum(count) + ' soru) taşınacak. Hiyerarşi için “>” kullanın. Var olan bir konu adını yazarsanız iki konu birleşir.</p>' +
        '<label class="field"><span>Yeni konu yolu</span><input class="input" name="topic" list="topicList" value="' + esc(key) + '"></label>' +
        '<datalist id="topicList">' + [...all].sort((a, b) => a.localeCompare(b, 'tr')).map(k => '<option value="' + esc(k) + '">').join('') + '</datalist>' +
        '<p class="merge-note warn-text small" hidden></p>',
      actions: [{ label: 'Vazgeç', value: null, kind: 'ghost' }, { label: 'Kaydet', value: 'save', kind: 'primary' }],
      onOpen: w => {
        const inp = w.querySelector('input[name=topic]');
        const note = w.querySelector('.merge-note');
        inp.addEventListener('input', () => {
          const nk = QP.splitTopic(inp.value).join(' > ');
          const merging = nk !== key && all.has(nk);
          note.hidden = !merging;
          note.textContent = merging ? '“' + nk + '” zaten var: sorular bu konuyla birleştirilecek.' : '';
        });
        inp.select();
      },
      onSubmit: async (v, w) => {
        const nk = QP.splitTopic(w.querySelector('input[name=topic]').value).join(' > ');
        if (!nk) throw new Error('Konu adı boş olamaz.');
        if (nk === key) return true;
        const n = await Store.renameTopic(key, nk);
        toast(fmtNum(n) + ' soru “' + nk + '” konusuna taşındı', 'ok');
        result = true;
        return true;
      }
    });
    return result;
  }

  async function renameSourceDialog(name) {
    const counts = Store.sourceCounts();
    let result = false;
    await modal({
      title: 'Kaynak adını değiştir',
      body: '<p class="muted small">“' + esc(name) + '” kaynağındaki ' + fmtNum(counts.get(name) || 0) + ' soru güncellenecek. Var olan bir kaynak adını yazarsanız iki kaynak birleşir. Sayfa bilgileri korunur.</p>' +
        '<label class="field"><span>Yeni kaynak adı</span><input class="input" name="src" list="srcList" value="' + esc(name) + '"></label>' +
        '<datalist id="srcList">' + [...counts.keys()].filter(Boolean).map(k => '<option value="' + esc(k) + '">').join('') + '</datalist>',
      actions: [{ label: 'Vazgeç', value: null, kind: 'ghost' }, { label: 'Kaydet', value: 'save', kind: 'primary' }],
      onOpen: w => w.querySelector('input').select(),
      onSubmit: async (v, w) => {
        const nn = w.querySelector('input[name=src]').value.replace(/\s+/g, ' ').trim();
        if (!nn) throw new Error('Kaynak adı boş olamaz.');
        if (nn === name) return true;
        const n = await Store.renameSource(name, nn);
        toast(fmtNum(n) + ' soru güncellendi', 'ok');
        result = true;
        return true;
      }
    });
    return result;
  }

  // Silme onayı: isteğe bağlı olarak önce yedek indirir
  async function confirmDelete(title, text) {
    const v = await modal({
      title,
      body: '<p>' + esc(text) + '</p><p class="muted small">Bu işlem geri alınamaz. Emin değilseniz önce yedek indirin; gerekirse Dosya Yükle → Yedeği Yükle ile geri getirebilirsiniz.</p>',
      actions: [
        { label: 'Vazgeç', value: null, kind: 'ghost' },
        { label: 'Yedek indir ve sil', value: 'backup', kind: 'danger-soft' },
        { label: 'Sil', value: 'delete', kind: 'danger' }
      ]
    });
    if (v === 'backup') { downloadBackup(); return true; }
    return v === 'delete';
  }

  async function deleteSourceDialog(name) {
    const plan = Store.sourcePlan(name);
    const total = plan.only.length + plan.shared.length;
    if (!total) return false;
    const label = sourceLabel(name);
    let text = '“' + label + '” kaynağındaki ' + fmtNum(total) + ' soru için: ';
    const parts = [];
    if (plan.only.length) parts.push(fmtNum(plan.only.length) + ' soru (yalnızca bu kaynakta) favori ve çözüm geçmişiyle birlikte silinecek');
    if (plan.shared.length) parts.push(fmtNum(plan.shared.length) + ' soru başka kaynaklarda da bulunduğu için silinmeyecek, yalnızca bu kaynak bilgisi kaldırılacak');
    text += parts.join('; ') + '.';
    const go = await confirmDelete('Kaynak silinsin mi?', text);
    if (!go) return false;
    const r = await Store.deleteSource(name);
    toast(fmtNum(r.deleted) + ' soru silindi' + (r.detached ? ', ' + fmtNum(r.detached) + ' sorudan kaynak kaldırıldı' : ''), 'ok');
    return true;
  }

  async function editQuestion(id) {
    const q = S.questions.get(id);
    if (!q) return false;
    let saved = false;
    const ta = (name, label, val, rows) => '<label class="field"><span>' + label + '</span><textarea class="input" name="' + name + '" rows="' + (rows || 2) + '">' + esc(val) + '</textarea></label>';
    await modal({
      title: 'Soruyu düzenle',
      wide: true,
      body: '<form class="edit-form" onsubmit="return false">' +
        '<label class="field"><span>Konu (hiyerarşi için “>”)</span><input class="input" name="topic" value="' + esc(q.topic) + '"></label>' +
        '<div class="grid-2">' +
        '<label class="field"><span>Soru tipi</span><input class="input" name="type" value="' + esc(q.type) + '"></label>' +
        '<label class="field"><span>Zorluk</span><select class="input" name="difficulty"><option value="">Belirtilmemiş</option>' +
        [1, 2, 3, 4, 5].map(d => '<option value="' + d + '"' + (q.difficulty === d ? ' selected' : '') + '>' + d + '</option>').join('') + '</select></label>' +
        '</div>' +
        '<label class="field"><span>İlişkili konular (virgülle)</span><input class="input" name="related" value="' + esc((q.related || []).join(', ')) + '"></label>' +
        ta('sources', 'Kaynak(lar) — her satıra bir tane, “Kitap; sayfa”', q.sources.map(s => s.raw || (s.name + (s.page ? '; ' + s.page : ''))).join('\n'), 2) +
        ta('stem', 'Soru kökü', q.stem, 5) +
        LETTERS.map(L => ta('opt' + L, 'Şık ' + L, q.options[L], 2)).join('') +
        '<label class="field"><span>Doğru cevap</span><select class="input" name="answer">' + LETTERS.map(L => '<option' + (L === q.answer ? ' selected' : '') + '>' + L + '</option>').join('') + '</select></label>' +
        ta('explanation', 'Açıklama', q.explanation, 8) +
        '</form>',
      actions: [{ label: 'Vazgeç', value: null, kind: 'ghost' }, { label: 'Kaydet', value: 'save', kind: 'primary' }],
      onSubmit: async (v, w) => {
        const f = w.querySelector('form');
        const val = n => f.elements[n].value;
        const options = {};
        for (const L of LETTERS) {
          options[L] = val('opt' + L).trim();
          if (!options[L]) throw new Error('Şık ' + L + ' boş olamaz.');
        }
        if (!val('stem').trim()) throw new Error('Soru kökü boş olamaz.');
        const topicPath = QP.splitTopic(val('topic'));
        const oldSources = q.sources || [];
        const sources = val('sources').split('\n').map(l => l.trim()).filter(Boolean).map(raw => {
          const s = QP.parseSource(raw);
          const prev = oldSources.find(o => (o.raw || '') === raw);
          s.file = prev ? prev.file : '';
          return s;
        });
        await Store.updateQuestion(id, {
          topic: topicPath.length ? topicPath.join(' > ') : 'Konusuz',
          type: val('type').trim(),
          difficulty: val('difficulty') ? Number(val('difficulty')) : null,
          related: QP.splitTags(val('related')),
          sources,
          stem: val('stem').trim(),
          options,
          answer: val('answer'),
          explanation: val('explanation').trim()
        });
        saved = true;
        return true;
      }
    });
    return saved;
  }

  // ---------- Dosya Yükle & Yedek ----------
  let pendingFiles = null;
  let pendingBackup = null;

  function viewUpload(params) {
    const bs = backupStatus();
    view.innerHTML =
      '<div class="page-head"><div><h1>Dosya Yükle</h1><p class="muted">Markdown (.md) soru dosyalarını ekle; aynı soru ikinci kez eklenmez.</p></div></div>' +
      '<section class="card">' +
      '<div class="dropzone" tabindex="0" role="button" aria-label="Dosya seç veya sürükle bırak">' +
      '<div class="dz-icon">' + ICON.upload + '</div>' +
      '<p class="dz-title">.md dosyalarını buraya sürükleyin</p>' +
      '<p class="muted">veya</p>' +
      '<span class="btn primary">Dosya Seç</span>' +
      '<p class="muted small">Birden fazla dosya seçebilirsiniz.</p>' +
      '<input type="file" class="file-input" multiple hidden>' +
      '</div>' +
      '<div class="preview"></div>' +
      '</section>' +
      '<section class="card" id="yedek">' +
      '<h2 class="card-title">Yedekleme ve cihaz değiştirme</h2>' +
      '<div class="notice warn">' + ICON.warn + '<div><strong>Verileriniz yalnızca bu tarayıcıda saklanır.</strong> Tarayıcı geçmişini/site verilerini temizlerseniz, gizli sekme kullanırsanız veya tarayıcıyı kaldırırsanız sorular ve çözüm geçmişi silinebilir. Düzenli olarak yedek indirin ve güvenli bir yerde (ör. bulut klasörü) saklayın.</div></div>' +
      '<p class="muted">' + esc(bs.text) + '</p>' +
      '<p>Yedek; tüm soruları, kaynakları, konuları, favorileri, çözüm geçmişini ve yarım kalan testleri içerir. Diğer cihazda bu sayfadan <strong>Yedeği Yükle</strong> ile açın.</p>' +
      '<div class="row wrap">' +
      '<button type="button" class="btn primary" data-backup-dl' + (S.questions.size ? '' : ' disabled') + '>' + ICON.download + 'Yedek İndir (.json)</button>' +
      '<button type="button" class="btn ghost" data-backup-pick>' + ICON.upload + 'Yedeği Yükle</button>' +
      '<input type="file" class="backup-input" hidden>' +
      '</div>' +
      '<div class="backup-preview"></div>' +
      '<div class="storage-info muted small"></div>' +
      '</section>' +
      '<section class="card danger-zone"><h2 class="card-title">Tüm verileri sil</h2>' +
      '<p class="muted">Bu tarayıcıdaki tüm sorular, çözüm geçmişi, favoriler ve testler silinir. Önce yedek almanız önerilir.</p>' +
      '<button type="button" class="btn danger-soft" data-wipe' + (S.questions.size || S.attempts.length || S.tests.size ? '' : ' disabled') + '>' + ICON.trash + 'Tüm Verileri Sil</button></section>';

    const dz = view.querySelector('.dropzone');
    const fi = view.querySelector('.file-input');
    const preview = view.querySelector('.preview');
    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => handleFiles([...e.dataTransfer.files]));
    fi.addEventListener('change', () => { handleFiles([...fi.files]); fi.value = ''; });

    async function handleFiles(files) {
      if (!files.length) return;
      const parsed = [];
      const skipped = [];
      for (const f of files) {
        if (/\.json$/i.test(f.name)) { skipped.push(f.name + ' — yedek dosyası gibi görünüyor; aşağıdaki “Yedeği Yükle” düğmesini kullanın.'); continue; }
        if (/\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|gif|zip)$/i.test(f.name)) { skipped.push(f.name + ' — desteklenmeyen dosya türü (yalnızca .md).'); continue; }
        let text;
        try { text = await f.text(); } catch (err) { skipped.push(f.name + ' — okunamadı.'); continue; }
        const r = QP.parseFile(text, f.name);
        if (!r.items.length) { skipped.push(f.name + ' — soru bulunamadı (QUESTION_START işaretleri veya “## Soru” başlıkları yok).'); continue; }
        parsed.push(r);
      }
      pendingFiles = parsed;
      renderPreview(skipped);
    }

    function renderPreview(skipped) {
      if (!pendingFiles || (!pendingFiles.length && !skipped.length)) { preview.innerHTML = ''; return; }
      const tot = Store.classify(pendingFiles);
      const dupCount = tot.dup;
      let html = '<div class="pv">';
      if (pendingFiles.length) {
        html += '<div class="pv-summary">' +
          '<span class="pill">' + fmtNum(tot.found) + ' soru bulundu</span>' +
          '<span class="pill ok">' + fmtNum(tot.fresh) + ' yeni</span>' +
          '<span class="pill">' + fmtNum(dupCount) + ' tekrar</span>' +
          '<span class="pill ' + (tot.errors ? 'bad' : '') + '">' + fmtNum(tot.errors) + ' hatalı</span>' +
          '</div>';
        html += '<ul class="pv-files">' + pendingFiles.map(f => {
          const sm = f.summary;
          const errs = f.items.filter(i => i.status === 'error');
          const dups = f.items.filter(i => i.status === 'dup-bank' || i.status === 'dup-batch');
          const warns = f.items.filter(i => i.status !== 'error' && i.warnings.length);
          return '<li class="pv-file"><div class="pv-file-head">' + ICON.file + '<strong>' + esc(f.fileName) + '</strong>' +
            '<span class="muted">' + sm.found + ' soru · ' + sm.fresh + ' yeni · ' + sm.dup + ' tekrar · ' + sm.errors + ' hatalı</span></div>' +
            (errs.length ? '<div class="pv-issues bad"><strong>Hatalı sorular (içe aktarılmayacak):</strong><ul>' + errs.map(i => '<li><b>' + esc(i.label) + ':</b> ' + esc(i.errors.join('; ')) + '</li>').join('') + '</ul></div>' : '') +
            (dups.length ? '<details class="pv-issues"><summary>Tekrar eden sorular (' + dups.length + ')</summary><ul>' + dups.map(i => '<li><b>' + esc(i.label) + ':</b> ' +
              (i.status === 'dup-batch' ? 'bu yüklemede ' + esc(i.dupOf.fileName + ' / ' + i.dupOf.label) + ' ile aynı' : 'bankada zaten var' + (i.addsSource ? ' — yeni kaynak bilgisi eklenecek' : '')) + '</li>').join('') + '</ul></details>' : '') +
            (warns.length ? '<details class="pv-issues"><summary>Uyarılar (' + warns.length + ')</summary><ul>' + warns.map(i => '<li><b>' + esc(i.label) + ':</b> ' + esc(i.warnings.join('; ')) + '</li>').join('') + '</ul></details>' : '') +
            '</li>';
        }).join('') + '</ul>';
      }
      if (skipped.length) html += '<div class="pv-issues bad"><strong>Atlanan dosyalar:</strong><ul>' + skipped.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul></div>';
      const canImport = tot.fresh > 0 || tot.sourceAdds > 0;
      const label = tot.fresh ? 'İçe Aktar (' + fmtNum(tot.fresh) + ' yeni soru)' : tot.sourceAdds ? 'Kaynak bilgilerini kaydet' : 'Eklenecek yeni soru yok';
      html += '<div class="row wrap end"><button type="button" class="btn ghost" data-cancel>Vazgeç</button>' +
        (pendingFiles.length ? '<button type="button" class="btn primary lg" data-import' + (canImport ? '' : ' disabled') + '>' + esc(label) + '</button>' : '') + '</div></div>';
      preview.innerHTML = html;
      const imp = preview.querySelector('[data-import]');
      if (imp) imp.addEventListener('click', async () => {
        imp.disabled = true;
        try {
          requestPersist();
          const r = await Store.commitImport(pendingFiles);
          pendingFiles = null;
          preview.innerHTML = '<div class="notice ok">' + ICON.check + '<div><strong>' + fmtNum(r.added) + ' soru eklendi.</strong>' +
            (r.merged ? ' ' + fmtNum(r.merged) + ' mevcut soruya kaynak bilgisi eklendi.' : '') +
            ' Bankada toplam ' + fmtNum(S.questions.size) + ' soru var.</div></div>' +
            '<div class="row wrap"><a class="btn primary" href="#/test">' + ICON.play + 'Test Oluştur</a><a class="btn ghost" href="#/banka">Soru Bankası</a></div>';
          view.querySelector('[data-backup-dl]').disabled = false;
          view.querySelector('[data-wipe]').disabled = false;
          toast(fmtNum(r.added) + ' soru eklendi', 'ok');
        } catch (err) {
          imp.disabled = false;
          toast('Kaydedilemedi: ' + err.message, 'err');
        }
      });
      preview.querySelector('[data-cancel]').addEventListener('click', () => { pendingFiles = null; preview.innerHTML = ''; });
    }

    // Yedek
    const bi = view.querySelector('.backup-input');
    const bp = view.querySelector('.backup-preview');
    view.querySelector('[data-backup-dl]').addEventListener('click', () => downloadBackup());
    view.querySelector('[data-backup-pick]').addEventListener('click', () => bi.click());
    bi.addEventListener('change', async () => {
      const f = bi.files[0];
      bi.value = '';
      if (!f) return;
      try {
        pendingBackup = Store.parseBackup(await f.text());
      } catch (err) {
        pendingBackup = null;
        bp.innerHTML = '<div class="notice bad">' + ICON.warn + '<div>' + esc(err.message) + '</div></div>';
        return;
      }
      const d = pendingBackup;
      const hasData = S.questions.size > 0;
      bp.innerHTML = '<div class="pv">' +
        '<p><strong>' + esc(f.name) + '</strong>' + (d.exportedAt ? ' · ' + esc(fmtDate(Date.parse(d.exportedAt))) : '') + '</p>' +
        '<div class="pv-summary"><span class="pill">' + fmtNum(d.questions.length) + ' soru</span><span class="pill">' + fmtNum(d.attempts.length) + ' çözüm</span>' +
        '<span class="pill">' + fmtNum(d.favorites.length) + ' favori</span><span class="pill">' + fmtNum(d.tests.length) + ' test</span>' +
        (d.invalid ? '<span class="pill bad">' + d.invalid + ' bozuk kayıt atlanacak</span>' : '') + '</div>' +
        (hasData ? '<fieldset class="mode"><legend>Bu cihazda zaten ' + fmtNum(S.questions.size) + ' soru var. Nasıl yüklensin?</legend>' +
          '<label class="radio-card"><input type="radio" name="bmode" value="merge" checked><span><strong>Birleştir (önerilen)</strong><br><span class="muted small">Mevcut veriler korunur; aynı sorular ve çözümler tekrar eklenmez, yalnızca eksikler eklenir.</span></span></label>' +
          '<label class="radio-card"><input type="radio" name="bmode" value="replace"><span><strong>Tamamen değiştir</strong><br><span class="muted small">Bu cihazdaki tüm veriler silinir ve yerine yedektekiler yüklenir.</span></span></label>' +
          '</fieldset>' : '') +
        '<div class="row wrap end"><button type="button" class="btn ghost" data-bcancel>Vazgeç</button><button type="button" class="btn primary" data-bimport>Yedeği Yükle</button></div></div>';
      bp.querySelector('[data-bcancel]').addEventListener('click', () => { pendingBackup = null; bp.innerHTML = ''; });
      bp.querySelector('[data-bimport]').addEventListener('click', async e => {
        const modeEl = bp.querySelector('input[name=bmode]:checked');
        const mode = modeEl ? modeEl.value : 'merge';
        if (mode === 'replace') {
          const choice = await modal({
            title: 'Tüm veriler değiştirilsin mi?',
            body: '<p>Bu cihazdaki ' + fmtNum(S.questions.size) + ' soru, ' + fmtNum(S.attempts.length) + ' çözüm ve tüm testler silinip yedektekiler yüklenecek.</p>' +
              '<label class="check"><input type="checkbox" name="pre" checked><span>Önce mevcut verilerin yedeğini indir</span></label>',
            actions: [{ label: 'Vazgeç', value: null, kind: 'ghost' }, { label: 'Değiştir', value: 'ok', kind: 'danger' }],
            onSubmit: async (v, w) => { if (w.querySelector('input[name=pre]').checked) downloadBackup(); return true; }
          });
          if (!choice) return;
        }
        e.target.disabled = true;
        try {
          requestPersist();
          const r = await Store.importBackup(pendingBackup, mode);
          pendingBackup = null;
          const parts = [fmtNum(r.added) + ' yeni soru'];
          if (mode === 'merge') parts.push(fmtNum(r.updated) + ' güncellenen', fmtNum(r.unchanged) + ' zaten mevcut');
          parts.push(fmtNum(r.attempts) + ' çözüm', fmtNum(r.favorites) + ' favori', fmtNum(r.tests) + ' test');
          toast('Yedek yüklendi', 'ok');
          viewUpload();
          view.querySelector('.backup-preview').innerHTML = '<div class="notice ok">' + ICON.check + '<div><strong>Yedek yüklendi.</strong> ' + esc(parts.join(' · ')) + '. Bankada toplam ' + fmtNum(S.questions.size) + ' soru var.</div></div>';
        } catch (err) {
          e.target.disabled = false;
          toast('Yedek yüklenemedi: ' + err.message, 'err');
        }
      });
    });

    view.querySelector('[data-wipe]').addEventListener('click', async () => {
      let ok = false;
      await modal({
        title: 'Tüm veriler silinsin mi?',
        body: '<p>' + fmtNum(S.questions.size) + ' soru, ' + fmtNum(S.attempts.length) + ' çözüm kaydı, favoriler ve testler <strong>kalıcı olarak</strong> silinecek.</p>' +
          '<label class="field"><span>Onaylamak için <strong>SİL</strong> yazın</span><input class="input" name="confirm" autocomplete="off"></label>',
        actions: [{ label: 'Vazgeç', value: null, kind: 'ghost' }, { label: 'Kalıcı Olarak Sil', value: 'ok', kind: 'danger' }],
        onSubmit: async (v, w) => {
          const t = w.querySelector('input[name=confirm]').value.trim().toLocaleUpperCase('tr');
          if (t !== 'SİL' && t !== 'SIL') throw new Error('Onay için SİL yazın.');
          await Store.clearAll();
          ok = true;
          return true;
        }
      });
      if (ok) { toast('Tüm veriler silindi'); viewUpload(); }
    });

    // Depolama bilgisi
    (async () => {
      const el = view.querySelector('.storage-info');
      if (!el || !navigator.storage) return;
      try {
        const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
        const est = navigator.storage.estimate ? await navigator.storage.estimate() : null;
        let s = persisted ? 'Kalıcı depolama: açık (tarayıcı verileri kendiliğinden silmez).' : 'Kalıcı depolama: kapalı — tarayıcı yer azaldığında verileri silebilir.';
        if (est && est.usage != null) s += ' Kullanılan alan: ' + (est.usage / 1048576).toFixed(1) + ' MB.';
        el.textContent = s;
        if (!persisted && navigator.storage.persist) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'link-btn';
          b.textContent = 'Kalıcı depolama iste';
          b.addEventListener('click', async () => {
            const r = await navigator.storage.persist();
            toast(r ? 'Kalıcı depolama açıldı' : 'Tarayıcı kalıcı depolamaya izin vermedi', r ? 'ok' : 'err');
            if (r) el.textContent = 'Kalıcı depolama: açık (tarayıcı verileri kendiliğinden silmez).';
          });
          el.append(' ', b);
        }
      } catch (e) { /* desteklenmiyor */ }
    })();

    if (params === 'yedek') setTimeout(() => document.getElementById('yedek').scrollIntoView({ behavior: 'smooth' }), 30);
  }

  // ---------- İstatistikler ----------
  function viewStats() {
    if (!S.questions.size) { view.innerHTML = '<div class="page-head"><h1>İstatistikler</h1></div>' + emptyBank(); return; }
    const agg = new Map();
    const srcAgg = new Map();
    const bump = (m, k, q, p) => {
      let r = m.get(k);
      if (!r) { r = { q: 0, solved: 0, n: 0, c: 0, lastWrong: 0 }; m.set(k, r); }
      r.q++;
      if (p) { r.solved++; r.n += p.n; r.c += p.correct; if (p.last === false) r.lastWrong++; }
    };
    for (const q of S.questions.values()) {
      const p = S.progress.get(q.id);
      const parts = q.topic.split(' > ');
      for (let i = 1; i <= parts.length; i++) bump(agg, parts.slice(0, i).join(' > '), q, p);
      for (const n of new Set(Store.sourceNames(q))) bump(srcAgg, n, q, p);
    }
    let total = 0, correct = 0;
    for (const a of S.attempts) if (S.questions.has(a.qid)) { total++; if (a.correct) correct++; }
    const pc = Store.poolCounts();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayCount = S.attempts.filter(a => a.at >= today.getTime()).length;
    const weekCount = S.attempts.filter(a => a.at >= today.getTime() - 6 * 864e5).length;

    const rowHTML = (label, r, depth, key) =>
      '<tr class="d' + depth + '"' + (key ? ' data-k="' + esc(key) + '"' : '') + '><th scope="row"><span style="padding-left:' + (depth * 16) + 'px">' + esc(label) + '</span></th>' +
      '<td>' + fmtNum(r.q) + '</td><td>' + fmtNum(r.solved) + '</td>' +
      '<td class="acc"><span class="mini-bar"><span style="width:' + (r.n ? Math.round((r.c / r.n) * 100) : 0) + '%"></span></span>' + pct(r.c, r.n) + '</td>' +
      '<td>' + (r.lastWrong ? '<span class="err-text">' + r.lastWrong + '</span>' : '0') + '</td></tr>';

    const topicRows = [...agg.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'tr'))
      .map(([k, r]) => { const parts = k.split(' > '); return rowHTML(parts[parts.length - 1], r, parts.length - 1, k); }).join('');
    const srcRows = [...srcAgg.entries()].sort((a, b) => b[1].q - a[1].q).map(([k, r]) => rowHTML(sourceLabel(k), r, 0)).join('');

    const weak = [...agg.entries()].filter(([, r]) => r.n >= 3).map(([k, r]) => ({ k, rate: r.c / r.n, r }))
      .sort((a, b) => a.rate - b.rate).slice(0, 5);

    const head = '<thead><tr><th scope="col">Ad</th><th scope="col">Soru</th><th scope="col">Çözülen</th><th scope="col">Doğru oranı</th><th scope="col">Son yanlış</th></tr></thead>';
    view.innerHTML =
      '<div class="page-head"><div><h1>İstatistikler</h1><p class="muted">Çözüm geçmişine göre konu ve kaynak performansı.</p></div></div>' +
      '<div class="stats-grid">' +
      statCard('Toplam çözüm', fmtNum(total), 'Bugün ' + fmtNum(todayCount) + ' · 7 gün ' + fmtNum(weekCount)) +
      statCard('Doğru oranı', pct(correct, total), fmtNum(correct) + ' doğru · ' + fmtNum(total - correct) + ' yanlış', 'accent') +
      statCard('Çözülen soru', fmtNum(S.questions.size - pc.unsolved), '/ ' + fmtNum(S.questions.size) + ' soru') +
      statCard('Son çözümü yanlış', fmtNum(pc.wrong), 'Tekrar edilmesi gereken', pc.wrong ? 'danger' : '', pc.wrong ? '#/test' : null) +
      '</div>' +
      (weak.length ? '<section class="card"><h2 class="card-title">Zorlandığın konular</h2><p class="muted small">En az 3 çözümü olan konular arasında doğru oranı en düşük olanlar.</p><div class="bars">' +
        weak.map(w => '<div class="bar-row"><span class="bar-label">' + esc(w.k) + '</span><span class="bar warn"><span style="width:' + Math.round(w.rate * 100) + '%"></span></span><span class="bar-val">' + pct(w.r.c, w.r.n) + '</span></div>').join('') +
        '</div></section>' : '') +
      '<section class="card"><h2 class="card-title">Konulara göre</h2><div class="table-wrap"><table class="stats-table">' + head + '<tbody>' + topicRows + '</tbody></table></div></section>' +
      '<section class="card"><h2 class="card-title">Kaynaklara göre</h2><div class="table-wrap"><table class="stats-table">' + head + '<tbody>' + srcRows + '</tbody></table></div></section>';
  }

  // ---------- Yönlendirme ----------
  function setNav(name) {
    document.querySelectorAll('[data-nav]').forEach(a => {
      if (a.dataset.nav === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  let lastPath = null;
  function route() {
    keyHandler = null;
    view.onclick = null;
    view.onchange = null;
    view.ontouchstart = view.ontouchmove = view.ontouchend = view.ontouchcancel = null;
    const h = location.hash || '#/';
    const [path, query] = h.split('?');
    document.body.classList.toggle('solving', /^#\/test\/[\w-]+$/.test(path));
    if (path !== lastPath) window.scrollTo(0, 0);
    lastPath = path;
    let m;
    if (path === '#/' || path === '#' || path === '') { setNav('home'); viewHome(); }
    else if (path === '#/test') { setNav('test'); viewBuilder(); }
    else if ((m = /^#\/test\/([\w-]+)$/.exec(path))) { setNav('test'); viewSolve(m[1]); }
    else if ((m = /^#\/sonuc\/([\w-]+)$/.exec(path))) { setNav('test'); viewResult(m[1]); }
    else if (path === '#/banka') { setNav('banka'); viewBank(); }
    else if (path === '#/yukle') { setNav('yukle'); viewUpload(query); }
    else if (path === '#/istatistik') { setNav('istatistik'); viewStats(); }
    else { location.hash = '#/'; return; }
    document.title = (document.querySelector('#view h1') ? document.querySelector('#view h1').textContent + ' · ' : '') + 'KBB Soru Bankası';
  }

  document.addEventListener('keydown', e => { if (keyHandler) keyHandler(e); });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => e.preventDefault());
  window.addEventListener('hashchange', route);

  Store.load().then(() => {
    route();
  }).catch(err => {
    view.innerHTML = '<section class="card empty"><h2>Veritabanı açılamadı</h2><p>' + esc(err.message || String(err)) + '</p>' +
      '<p class="muted">Gizli/özel sekmede veya site verilerinin engellendiği durumlarda tarayıcı depolaması çalışmayabilir.</p></section>';
  });
})();
