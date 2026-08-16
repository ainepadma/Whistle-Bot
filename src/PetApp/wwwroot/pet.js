(function () {
  'use strict';
  const DATA = window.GROKBOT_ORIGINAL;
  const bot = document.querySelector('#bot');
  const stage = document.querySelector('#stage');
  const tooltip = document.querySelector('#pet-tooltip');
    const eyeEls = [document.querySelector('#eye-0'), document.querySelector('#eye-1')];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const NOTE_GLYPHS = ['♪', '♫', '♬', '♩', '♭', '♮', '♯', '🎵', '🎶'];
  const NOTE_COLORS = ['#ff9f43', '#ff7bac', '#7ae0c3', '#9aa7ff', '#ffd166', '#5fc9f2', '#f2a6ff', '#ff6b81'];
  const centroid = ring => ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
  const ringPath = ring => 'M' + ring.map(p => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L') + 'Z';

  let expression = 0;
  let current = DATA.EXPRESSIONS[0].map(r => r.map(p => [...p]));
  let target = DATA.EXPRESSIONS[0];
  let morph = 1, velocity = 0, last = performance.now(), blinkStart = 0, gazeX = 0, gazeY = 0;
  let tooltipTimer = 0;

  const rings = () => current.map((ring, e) => ring.map((p, i) =>
    [p[0] + (target[e][i][0] - p[0]) * clamp(morph, 0, 1), p[1] + (target[e][i][1] - p[1]) * clamp(morph, 0, 1)]));
  function chooseExpression(index) {
    current = rings();
    target = DATA.EXPRESSIONS[index];
    expression = index; morph = 0; velocity = 0;
  }
  const blinkScale = now => {
    if (!blinkStart) return 1;
    const t = (now - blinkStart) / 320;
    if (t >= 1) { blinkStart = 0; return 1; }
    return Math.max(t < .42 ? 1 - t / .42 : (t - .42) / .58, .04);
  };
  const blink = () => { blinkStart = performance.now(); };
  function frame(now) {
    const dt = Math.min((now - last) / 1000, .1);
    last = now;
    velocity += (-14 * velocity - 49 * (morph - 1)) * dt;
    morph += velocity * dt;
    if (!Number.isFinite(morph)) { morph = 1; velocity = 0; }
    const shown = rings(), bs = blinkScale(now);
    shown.forEach((ring, i) => {
      const c = centroid(ring);
      const base = Math.asin(clamp((c[0] - 114.2705) / 105, -1, 1));
      const longitude = base;
      const depth = Math.cos(longitude);
      const perspective = Math.max(depth, .02) / Math.max(Math.cos(base), .02);
      const x = 114.2705 + 105 * Math.sin(longitude) + gazeX;
      const y = c[1] + gazeY;
      eyeEls[i].setAttribute('d', ringPath(ring));
      eyeEls[i].setAttribute('transform', `translate(${x} ${y}) scale(${clamp(perspective, .02, 2.4)} ${bs}) translate(${-c[0]} ${-c[1]})`);
      eyeEls[i].style.opacity = depth > .02 ? '1' : '0';
    });
    requestAnimationFrame(frame);
  }

  function showTooltip(text) {
    clearTimeout(tooltipTimer);
    tooltip.textContent = text;
    tooltip.hidden = false;
    requestAnimationFrame(() => tooltip.classList.add('show'));
    tooltipTimer = setTimeout(() => {
      tooltip.classList.remove('show');
      setTimeout(() => { tooltip.hidden = true; }, 300);
    }, 1600);
  }

  // ---- behavior state machine ----
  const BEHAVIORS = {
    appear: { label: '出现', pool: ['spawning', 'waking', 'excited'], anim: 'anim-appear', cadence: [1200, 2200], once: true, next: 'standby' },
    standby: { label: '待机', pool: ['idle', 'listening', 'humming', 'loading', 'orbit', 'radar', 'progress'], anim: 'anim-breathe', cadence: [8000, 16000] },
    noInteraction: { label: '无互动', pool: ['bored', 'confused', 'shy', 'sad', 'suspicious'], anim: 'anim-droop', cadence: [4000, 9000] },
    interaction: { label: '互动', pool: ['happy', 'curious', 'playful', 'laughing', 'proud', 'celebrate', 'bouncing', 'surprised', 'scared'], anim: 'anim-bounce', cadence: [1200, 3200] },
    typing: { label: '敲键盘', pool: ['thinking', 'searching', 'working', 'writing', 'dictating', 'receiving', 'sending', 'uploading', 'notifying', 'alerting', 'dragging'], anim: 'anim-typing', cadence: [1500, 3400] },
    focus: { label: '专注', pool: ['working', 'thinking', 'progress', 'loading'], anim: 'anim-typing', cadence: [1800, 3400] },
    break: { label: '休息', pool: ['sleeping', 'drowsy', 'humming'], anim: 'anim-sleep', cadence: [5000, 10000] },
    systemIdle: { label: '系统待机', pool: ['sleeping', 'drowsy'], anim: 'anim-sleep', cadence: [6000, 14000] },
    despawn: { label: '消失', pool: ['powering-down', 'sleeping'], anim: 'anim-despawn', once: true, next: 'quit' }
  };
  let behavior = '';
  let stateTimer = 0, exprTimer = 0, bounceTimer = 0, lastTyping = 0, lastInteraction = performance.now(), interactionUntil = 0;
  let focusOverride = '';

  function applyState(name) {
    const pool = DATA.POOLS[name] || [0];
    chooseExpression(pool[Math.floor(Math.random() * pool.length)]);
  }
  function cycleExpression() {
    const b = BEHAVIORS[behavior];
    const state = b.pool[Math.floor(Math.random() * b.pool.length)];
    applyState(state);
    const cad = b.cadence;
    exprTimer = setTimeout(cycleExpression, cad[0] + Math.random() * (cad[1] - cad[0]));
  }
  function cadenceSpan(b) { return b.cadence[0] + (b.cadence[1] - b.cadence[0]) * .7; }
  function bounceOnce() {
    clearTimeout(bounceTimer);
    bot.classList.remove('anim-bounce');
    void bot.offsetWidth;
    bot.classList.add('anim-bounce');
    bounceTimer = setTimeout(() => {
      if (behavior === 'interaction') {
        bot.classList.remove('anim-bounce');
        bot.classList.add('anim-breathe');
      }
    }, 2800);
  }
  function setBehavior(name) {
    if (behavior === name) {
      if (name === 'interaction') bounceOnce();
      return;
    }
    behavior = name;
    clearTimeout(stateTimer);
    clearTimeout(exprTimer);
    clearTimeout(bounceTimer);
    Object.values(BEHAVIORS).forEach(b => bot.classList.remove(b.anim));
    const b = BEHAVIORS[name];
    bot.classList.add(b.anim);
    applyState(b.pool[0]);
    showTooltip(b.label);
    if (name === 'interaction') bounceOnce();
    const cad = b.cadence;
    exprTimer = setTimeout(cycleExpression, cad[0]);
    if (b.once) stateTimer = setTimeout(() => {
      if (b.next === 'quit') quitPet(); else setBehavior(b.next);
    }, cadenceSpan(b));
  }
  function quitPet() {
    bot.classList.add('anim-despawn');
    setTimeout(() => post({ type: 'quit' }), 1100);
  }
  function post(msg) { if (window.chrome && chrome.webview) chrome.webview.postMessage(msg); }

  function applyModelSize(size) {
    // All presets keep their container (window) size but render the model
    // 50px smaller inside it: 小 150/200, 中 200/250, 大 250/300.
    let model = (size || 280) - 50;
    if (model < 120) model = 120;
    document.documentElement.style.setProperty('--pet-size', model + 'px');
  }
  function applyColor(color) {
    if (color) document.documentElement.style.setProperty('--pet-color', color);
  }

  // One varied musical note pops from the pet's top on every keystroke.
  function spawnNote() {
    if (stage.querySelectorAll('.pet-note').length >= 7) return;
    const r = bot.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const x = r.left - sr.left + r.width / 2 + (Math.random() * 20 - 10);
    const y = r.top - sr.top + 4 + Math.random() * 8;
    const glyph = NOTE_GLYPHS[Math.floor(Math.random() * NOTE_GLYPHS.length)];
    const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
    const size = 13 + Math.random() * 9;
    const drift = (Math.random() * 2 - 1) * 24;
    const rise = 48 + Math.random() * 30;
    const rot = (Math.random() * 2 - 1) * 28;
    const dur = .8 + Math.random() * .6;
    const note = document.createElement('span');
    note.className = 'pet-note ' + (Math.random() < .45 ? 'sway' : 'pop');
    note.textContent = glyph;
    note.style.cssText = 'left:' + x.toFixed(1) + 'px;top:' + y.toFixed(1) + 'px;' +
      'font-size:' + size.toFixed(1) + 'px;color:' + color + ';' +
      '--drift:' + drift.toFixed(1) + 'px;--rise:' + rise.toFixed(1) + 'px;' +
      '--rot:' + rot.toFixed(1) + 'deg;animation-duration:' + dur.toFixed(2) + 's';
    stage.appendChild(note);
    post({ type: 'note-spawn' });
    setTimeout(() => note.remove(), dur * 1000 + 150);
  }

  // Pomodoro state from the host: while a focus/break phase is running the pet
  // stays in that behavior; idle/paused releases the override back to the
  // normal state machine. Interaction may briefly interrupt, the next 1s
  // state push restores the focus/break expression.
  function applyFocusState(d) {
    const running = d.status === 'running';
    const mode = d.mode;
    const desired = running && mode === 'focus' ? 'focus'
      : running && (mode === 'short-break' || mode === 'long-break') ? 'break'
      : '';
    focusOverride = desired;
    if (desired) {
      if (behavior !== desired) setBehavior(desired);
    } else if (behavior === 'focus' || behavior === 'break') {
      setBehavior('standby');
    }
  }

  // native messages from the C# shell
  if (window.chrome && chrome.webview) {
    chrome.webview.addEventListener('message', e => {
      const d = e.data;
      if (d.type === 'systemIdle') {
        if (focusOverride) return;
        if (d.seconds > 300 && (behavior === 'standby' || behavior === 'noInteraction')) setBehavior('systemIdle');
        else if (d.seconds < 5 && behavior === 'systemIdle') setBehavior('standby');
      } else if (d.type === 'typing') {
        if (focusOverride) return;
        lastTyping = performance.now();
        if (behavior !== 'systemIdle' && behavior !== 'despawn') {
          setBehavior('typing');
          spawnNote();
        }
      } else if (d.type === 'interact') {
        interact();
      } else if (d.type === 'focus-state') {
        applyFocusState(d);
      } else if (d.type === 'toast') {
        showTooltip(d.text || '');
      } else if (d.type === 'size') {
        applyModelSize(d.size);
      } else if (d.type === 'set-color') {
        applyColor(d.color || '#2f86ed');
      } else if (d.type === 'quit') {
        setBehavior('despawn');
      }
    });
  }

  function interact() {
    lastInteraction = performance.now();
    interactionUntil = performance.now() + 6000;
    if (behavior !== 'despawn' && behavior !== 'systemIdle') setBehavior('interaction');
  }

  // no-interaction watchdog
  setInterval(() => {
    if (focusOverride) return;
    if (behavior === 'systemIdle' || behavior === 'despawn' || behavior === 'appear') return;
    if (performance.now() - lastInteraction > 120000 && behavior !== 'noInteraction') setBehavior('noInteraction');
    if (behavior === 'noInteraction' && performance.now() - lastInteraction < 120000) setBehavior('standby');
  }, 5000);
  setInterval(() => {
    if (focusOverride) return;
    if (behavior === 'typing' && performance.now() - lastTyping > 5000)
      setBehavior(interactionUntil > performance.now() ? 'interaction' : 'standby');
  }, 3000);

  // left click / drag on the model; right click opens the menu
  let downX = 0, downY = 0, downT = 0, dragging = false, suppressClick = false;
  stage.addEventListener('pointerdown', e => {
    if (e.button === 0) { downX = e.clientX; downY = e.clientY; downT = performance.now(); dragging = false; blink(); }
  });
  document.addEventListener('pointermove', e => {
    if (downT && !dragging) {
      const dx = e.clientX - downX, dy = e.clientY - downY;
      if (dx * dx + dy * dy > 36) dragging = true;
    }
    if (dragging) post({ type: 'drag', dx: e.movementX, dy: e.movementY });
  });
  document.addEventListener('pointerup', e => {
    if (downT && !dragging && e.button === 0) {
      if (!suppressClick) interact();
    }
    downT = 0; dragging = false; suppressClick = false;
  });
  stage.addEventListener('contextmenu', e => {
    e.preventDefault();
    suppressClick = true;
    post({ type: 'menu-open', x: e.clientX, y: e.clientY, iw: innerWidth, ih: innerHeight });
  });

  // hover counts as gentle interaction; gaze follows pointer
  stage.addEventListener('pointerenter', () => { if (performance.now() - lastInteraction > 30000) interact(); });
  stage.addEventListener('pointermove', e => {
    const box = stage.getBoundingClientRect();
    gazeX = clamp((e.clientX - box.left) / box.width * 2 - 1, -.6, .6) * 18;
    gazeY = clamp((e.clientY - box.top) / box.height * 2 - 1, -.6, .6) * 12;
  });
  stage.addEventListener('pointerleave', () => { gazeX = 0; gazeY = 0; });

  setInterval(() => { if (Math.random() < .5) blink(); }, 4200);

  // test override: ?behavior=typing etc.
  const urlBehavior = new URLSearchParams(location.search).get('behavior');
  const urlPos = new URLSearchParams(location.search).get('pos');
  // Apply the host config synchronously so the very first frame already shows
  // the correct (small) model instead of the CSS-default size.
  const urlSize = parseInt(new URLSearchParams(location.search).get('size') || '', 10);
  const urlColor = new URLSearchParams(location.search).get('color');
  if (urlSize > 0) applyModelSize(urlSize);
  if (urlColor) applyColor(urlColor);
  if (urlPos) post({ type: 'move', pos: urlPos });
  chooseExpression(0);
  if (urlBehavior && BEHAVIORS[urlBehavior]) {
    behavior = 'appear';
    setBehavior(urlBehavior);
    if (BEHAVIORS[urlBehavior].once && BEHAVIORS[urlBehavior].next) {
      clearTimeout(stateTimer);
      stateTimer = 0;
      BEHAVIORS[urlBehavior].once = false;
    }
  } else {
    setBehavior('appear');
  }
  requestAnimationFrame(frame);
})();
