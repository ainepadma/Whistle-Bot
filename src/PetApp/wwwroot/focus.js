(function () {
  'use strict';
  const PRESETS = [
    { id: '25-5', label: '25 / 5' },
    { id: '45-10', label: '45 / 10' },
    { id: '60-15', label: '60 / 15' },
    { id: 'custom', label: '自定义' }
  ];
  const el = {
    time: document.querySelector('#focus-time'),
    fill: document.querySelector('#focus-fill'),
    phase: document.querySelector('#focus-phase'),
    dots: document.querySelector('#focus-dots'),
    toggle: document.querySelector('#btn-toggle'),
    presets: document.querySelector('#focus-presets'),
    custom: document.querySelector('#focus-custom'),
    focus: document.querySelector('#fc-focus'),
    brk: document.querySelector('#fc-break'),
    long: document.querySelector('#fc-long'),
    rounds: document.querySelector('#fc-rounds'),
    apply: document.querySelector('#btn-apply-custom'),
    note: document.querySelector('#focus-note')
  };
  let state = null;
  let lastCustom = '';
  let downX = 0, downY = 0, dragging = false, suppressClick = false;

  function post(msg) {
    if (window.chrome && chrome.webview) chrome.webview.postMessage(msg);
  }
  function fmt(sec) {
    const s = Math.max(0, Math.round(sec));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function renderPresets() {
    el.presets.innerHTML = '';
    PRESETS.forEach(p => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = p.label;
      b.classList.toggle('on', !!state && state.presetId === p.id);
      b.disabled = !!state && state.status === 'running';
      b.addEventListener('click', () => post({ type: 'focus-preset', presetId: p.id }));
      el.presets.appendChild(b);
    });
  }
  function render() {
    if (!state) return;
    el.time.textContent = fmt(state.remainingSeconds);
    const pct = state.totalSeconds > 0
      ? Math.min(100, Math.max(0, (1 - state.remainingSeconds / state.totalSeconds) * 100))
      : 0;
    el.fill.style.width = pct.toFixed(1) + '%';
    el.phase.textContent = state.label || '';
    el.dots.innerHTML = '';
    const total = state.presetId === 'custom'
      ? Math.max(1, Math.min(8, state.customRounds || 4))
      : 4;
    for (let i = 0; i < total; i++) {
      const d = document.createElement('i');
      d.classList.toggle('on', i < (state.cycleIndex || 0));
      el.dots.appendChild(d);
    }
    el.toggle.textContent = state.status === 'running' ? '暂停'
      : state.status === 'paused' ? '继续' : '开始';
    el.toggle.classList.toggle('run', state.status === 'running');
    if (state.presetId === 'custom') {
      el.custom.hidden = false;
      const locked = state.status === 'running';
      const sig = [state.customMinutes, state.customBreakMinutes,
        state.customLongBreakMinutes, state.customRounds].join(':');
      const active = document.activeElement;
      const editing = active === el.focus || active === el.brk ||
        active === el.long || active === el.rounds;
      if (sig !== lastCustom && !editing) {
        lastCustom = sig;
        el.focus.value = state.customMinutes || 45;
        el.brk.value = state.customBreakMinutes || 5;
        el.long.value = state.customLongBreakMinutes || 15;
        el.rounds.value = state.customRounds || 6;
      }
      [el.focus, el.brk, el.long, el.rounds].forEach(i => { i.disabled = locked; });
      el.apply.disabled = locked;
    } else {
      el.custom.hidden = true;
    }
    renderPresets();
  }
  function showNote(text) {
    el.note.textContent = text;
    el.note.hidden = false;
    clearTimeout(showNote._t);
    showNote._t = setTimeout(() => { el.note.hidden = true; }, 2800);
  }

  if (window.chrome && chrome.webview) {
    chrome.webview.addEventListener('message', e => {
      const d = e.data;
      if (d.type === 'focus-state') {
        state = d;
        render();
      } else if (d.type === 'focus-finished') {
        showNote(d.text || (d.phase === 'focus' ? '专注完成！' : '休息结束'));
      }
    });
  }
  const panel = document.querySelector('#focus-panel');
  el.apply.addEventListener('click', () => {
    const clamp = (v, a, b, d) => Math.max(a, Math.min(b, Math.round(Number(v) || d)));
    const minutes = clamp(el.focus.value, 1, 180, 45);
    const breakMinutes = clamp(el.brk.value, 1, 120, 5);
    const longBreakMinutes = clamp(el.long.value, 1, 240, 15);
    const rounds = clamp(el.rounds.value, 1, 8, 6);
    el.focus.value = minutes;
    el.brk.value = breakMinutes;
    el.long.value = longBreakMinutes;
    el.rounds.value = rounds;
    post({
      type: 'focus-custom-duration',
      minutes,
      breakMinutes,
      longBreakMinutes,
      rounds
    });
  });
  [el.focus, el.brk, el.long, el.rounds].forEach(i => {
    i.addEventListener('keydown', e => {
      if (e.key === 'Enter') el.apply.click();
    });
  });
  panel.addEventListener('click', e => {
    if (suppressClick) { suppressClick = false; return; }
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'toggle') post({ type: 'focus-toggle' });
    else if (action === 'reset') post({ type: 'focus-reset' });
    else if (action === 'skip') post({ type: 'focus-skip' });
    else if (action === 'close') post({ type: 'focus-close' });
  });
  // Drag the card anywhere except on its buttons.
  panel.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button, input')) return;
    downX = e.clientX;
    downY = e.clientY;
    dragging = true;
    suppressClick = false;
    panel.classList.add('dragging');
    try { panel.setPointerCapture(e.pointerId); } catch (_) { }
  });
  document.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (dx * dx + dy * dy > 16) suppressClick = true;
    post({ type: 'focus-drag', dx: e.movementX, dy: e.movementY });
  });
  document.addEventListener('pointerup', () => {
    dragging = false;
    panel.classList.remove('dragging');
  });

  post({ type: 'focus-get-state' });
  renderPresets();
})();
