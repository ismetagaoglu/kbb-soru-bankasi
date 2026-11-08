/*
 * Geri bildirim efektleri: ses (Web Audio ile üretilir, dosya yok), titreşim, konfeti ve uçan yazılar.
 * Ayarlar localStorage'da: kbb.sound, kbb.haptic. "Hareketi azalt" tercihinde görsel efektler kapanır.
 */
(function () {
  'use strict';

  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* yok say */ } };
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Ses ----------
  let ctx = null;
  let master = null;
  function audio() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { ctx = new C(); } catch (e) { return null; }
      master = ctx.createGain();
      master.gain.value = 0.9;
      // Yumuşak sınırlayıcı: üst üste binen seslerde cızırtıyı önler
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  // iOS/Android: ses ancak bir dokunuşla açılabilir
  const unlock = () => {
    if (!get('kbb.sound', true)) return;
    const c = audio();
    if (c) {
      // sessiz kısa bir tampon çalarak kilidi aç
      const b = c.createBuffer(1, 1, 22050);
      const s = c.createBufferSource();
      s.buffer = b; s.connect(c.destination); s.start(0);
    }
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

  function tone(c, freq, at, dur, opts) {
    const o = opts || {};
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, at);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, at + dur);
    const vol = o.vol == null ? 0.16 : o.vol;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.012, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }
  // Parlak "çan" sesi: temel ton + oktav üstü harmonik
  function bell(c, freq, at, dur, vol) {
    tone(c, freq, at, dur, { type: 'sine', vol: vol || 0.15 });
    tone(c, freq * 2, at, dur * 0.6, { type: 'sine', vol: (vol || 0.15) * 0.35 });
    tone(c, freq * 3, at, dur * 0.3, { type: 'triangle', vol: (vol || 0.15) * 0.12 });
  }
  const semi = (f, n) => f * Math.pow(2, n / 12);

  const SOUNDS = {
    tap(c, t) { tone(c, 880, t, 0.05, { type: 'triangle', vol: 0.05 }); },
    correct(c, t, combo) {
      // Seri arttıkça ses yükselir (en fazla 1 oktav)
      const up = Math.min(Math.max((combo || 1) - 1, 0), 12);
      const base = semi(523.25, up);
      bell(c, base, t, 0.18, 0.13);
      bell(c, semi(base, 4), t + 0.07, 0.2, 0.13);
      bell(c, semi(base, 7), t + 0.14, 0.38, 0.15);
    },
    wrong(c, t) {
      tone(c, 220, t, 0.16, { type: 'square', vol: 0.045, slide: 196 });
      tone(c, 174.6, t + 0.15, 0.28, { type: 'square', vol: 0.045, slide: 146.8 });
    },
    combo(c, t, n) {
      const base = semi(523.25, Math.min(n, 12));
      [0, 4, 7, 12, 16].forEach((s, i) => bell(c, semi(base, s), t + i * 0.06, 0.3, 0.11));
    },
    level(c, t) {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => bell(c, f, t + i * 0.11, 0.3, 0.14));
      bell(c, 1318.5, t + 0.48, 0.7, 0.13);
      bell(c, 1046.5, t + 0.48, 0.7, 0.1);
    },
    goal(c, t) {
      [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => bell(c, f, t + i * 0.08, 0.35, 0.11));
    },
    finish(c, t, good) {
      if (good) {
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(c, f, t + i * 0.09, 0.4, 0.12));
      } else {
        [392, 493.88, 587.33].forEach((f, i) => bell(c, f, t + i * 0.12, 0.4, 0.1));
      }
    },
    star(c, t, i) { bell(c, semi(880, (i || 0) * 4), t, 0.35, 0.12); },
    swipe(c, t) { tone(c, 420, t, 0.07, { type: 'sine', vol: 0.035, slide: 620 }); }
  };

  function play(name, arg) {
    if (!get('kbb.sound', true)) return;
    const c = audio();
    if (!c || !SOUNDS[name]) return;
    try { SOUNDS[name](c, c.currentTime + 0.01, arg); } catch (e) { /* ses çalınamadı */ }
  }

  // ---------- Titreşim ----------
  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  const PATTERNS = {
    tap: 8,
    correct: [18, 40, 28],
    wrong: [70, 45, 70],
    combo: [15, 30, 15, 30, 40],
    level: [25, 40, 25, 40, 25, 40, 90],
    goal: [30, 50, 30, 50, 80],
    finish: [20, 40, 60]
  };
  function buzz(name) {
    if (!canVibrate || !get('kbb.haptic', true)) return;
    try { navigator.vibrate(PATTERNS[name] || name); } catch (e) { /* yok say */ }
  }

  // ---------- Konfeti ----------
  const COLORS = ['#0e7490', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#38bdf8'];
  let canvas = null, cctx = null, parts = [], raf = 0;
  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    cctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    if (!canvas) return;
    const d = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * d;
    canvas.height = innerHeight * d;
    cctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function confetti(o) {
    if (reduced()) return;
    ensureCanvas();
    const opts = o || {};
    const n = Math.min(opts.count || 60, 220);
    const x = opts.x == null ? innerWidth / 2 : opts.x;
    const y = opts.y == null ? innerHeight / 3 : opts.y;
    const spread = opts.spread || Math.PI * 2;
    const angle = opts.angle == null ? -Math.PI / 2 : opts.angle;
    const power = opts.power || 9;
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = power * (0.45 + Math.random() * 0.75);
      parts.push({
        x: opts.rain ? Math.random() * innerWidth : x,
        y: opts.rain ? -20 - Math.random() * innerHeight * 0.4 : y,
        vx: opts.rain ? (Math.random() - 0.5) * 2 : Math.cos(a) * v,
        vy: opts.rain ? 2 + Math.random() * 3 : Math.sin(a) * v,
        w: 5 + Math.random() * 6, h: 3 + Math.random() * 5,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        shape: Math.random() < 0.3 ? 1 : 0,
        life: 0, max: 90 + Math.random() * 70
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    cctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life < p.max && p.y < innerHeight + 30);
    for (const p of parts) {
      p.life++;
      p.vy += 0.22;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      const fade = p.life > p.max - 25 ? (p.max - p.life) / 25 : 1;
      cctx.save();
      cctx.globalAlpha = Math.max(fade, 0);
      cctx.translate(p.x, p.y);
      cctx.rotate(p.r);
      cctx.fillStyle = p.c;
      if (p.shape) { cctx.beginPath(); cctx.arc(0, 0, p.h / 1.4, 0, Math.PI * 2); cctx.fill(); }
      else cctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 1.7)) + 1);
      cctx.restore();
    }
    if (parts.length) raf = requestAnimationFrame(tick);
    else { raf = 0; cctx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function burstFrom(el, count, power) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: count || 40, power: power || 8, spread: Math.PI * 1.3 });
  }

  // ---------- Uçan yazı (+10 XP) ----------
  function floatText(el, text, kind) {
    if (!el || reduced()) return;
    const r = el.getBoundingClientRect();
    const s = document.createElement('div');
    s.className = 'fx-float ' + (kind || '');
    s.textContent = text;
    s.style.left = (r.left + r.width * 0.72) + 'px';
    s.style.top = (r.top + r.height / 2) + 'px';
    document.body.appendChild(s);
    s.addEventListener('animationend', () => s.remove());
    setTimeout(() => s.remove(), 2000);
  }

  // ---------- Büyük kutlama yazısı (seri, seviye) ----------
  function banner(title, sub, kind) {
    const b = document.createElement('div');
    b.className = 'fx-banner ' + (kind || '');
    b.setAttribute('role', 'status');
    b.innerHTML = '<div class="fx-banner-in"><strong></strong>' + (sub ? '<span></span>' : '') + '</div>';
    b.querySelector('strong').textContent = title;
    if (sub) b.querySelector('span').textContent = sub;
    document.body.appendChild(b);
    const done = () => b.remove();
    setTimeout(() => b.classList.add('out'), reduced() ? 1400 : 1500);
    setTimeout(done, 2000);
    b.addEventListener('click', done);
  }

  // Sayıyı yumuşakça artır (sonuç ekranı)
  function countUp(el, to, ms, fmt) {
    if (!el) return;
    const f = fmt || (v => String(v));
    if (reduced()) { el.textContent = f(to); return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min((now - t0) / ms, 1);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = f(Math.round(to * e));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  window.FX = {
    play, buzz, confetti, burstFrom, floatText, banner, countUp, reduced, canVibrate,
    get sound() { return get('kbb.sound', true); },
    set sound(v) { set('kbb.sound', !!v); if (v) audio(); },
    get haptic() { return get('kbb.haptic', true); },
    set haptic(v) { set('kbb.haptic', !!v); },
    // tek çağrıda ses + titreşim
    hit(name, arg) { play(name, arg); buzz(name); }
  };
})();
