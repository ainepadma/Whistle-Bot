(function () {
  'use strict';
  const MENU_COLORS = [
    ['可可棕', '#9a6737'], ['活力红', '#ff3347'], ['暖橙', '#ff6a00'], ['珊瑚', '#ff9800'],
    ['青绿', '#08c77a'], ['湖蓝', '#08b9a9'], ['经典蓝', '#2f86ed'], ['梦幻紫', '#8656f6'],
    ['桃粉', '#ff2d8b'], ['纯黑', '#000000']
  ];
  const MENU_SIZES = [['小', 224], ['中', 280], ['大', 336]];
  const menu = document.querySelector('#pet-menu');
  const subStyle = document.querySelector('#pet-sub-style');
  const subSettings = document.querySelector('#pet-sub-settings');
  const colorsRoot = document.querySelector('#pet-colors');
  const sizesRoot = document.querySelector('#pet-sizes');
  const autostartLabel = document.querySelector('#autostart-state');
  let state = { color: '#2f86ed', size: 280, autostart: false };

  function post(msg) {
    if (window.chrome && chrome.webview) chrome.webview.postMessage(msg);
  }
  function measureCurrent() {
    const prev = menu.style.maxHeight;
    menu.style.maxHeight = 'none';
    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    menu.style.maxHeight = prev || '';
    const r = menu.getBoundingClientRect();
    return { w, h, right: Math.max(w, Math.round(r.right - r.left)) };
  }
  function measureWith(styleOpen, settingsOpen) {
    subStyle.hidden = !styleOpen;
    subSettings.hidden = !settingsOpen;
    const m = measureCurrent();
    subStyle.hidden = true;
    subSettings.hidden = true;
    return m;
  }
  function postFit() {
    const m = measureCurrent();
    const r = menu.getBoundingClientRect();
    post({
      type: 'fit',
      cssWidth: m.w,
      cssHeight: m.h,
      innerWidth: window.innerWidth,
      expanded: !subStyle.hidden || !subSettings.hidden,
      menuRect: { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) }
    });
  }
  function render() {
    colorsRoot.innerHTML = '';
    MENU_COLORS.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = c[0];
      b.style.background = c[1];
      b.classList.toggle('on', state.color === c[1]);
      b.addEventListener('click', e => {
        e.stopPropagation();
        state.color = c[1];
        post({ type: 'color', color: c[1] });
        render();
      });
      colorsRoot.appendChild(b);
    });
    sizesRoot.innerHTML = '';
    MENU_SIZES.forEach(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s[0];
      b.classList.toggle('on', state.size === s[1]);
      b.addEventListener('click', e => {
        e.stopPropagation();
        state.size = s[1];
        post({ type: 'size', size: s[1] });
        render();
      });
      sizesRoot.appendChild(b);
    });
    autostartLabel.textContent = state.autostart ? '开' : '关';
  }

  if (window.chrome && chrome.webview) {
    chrome.webview.addEventListener('message', e => {
      const d = e.data;
      if (d.type === 'state') {
        state = { color: d.color || '#2f86ed', size: d.size || 280, autostart: !!d.autostart };
        render();
      } else if (d.type === 'reset') {
        subStyle.hidden = true;
        subSettings.hidden = true;
        postFit();
      } else if (d.type === 'expanded') {
        if (d.target === 'style') { subStyle.hidden = false; subSettings.hidden = true; }
        else if (d.target === 'settings') { subSettings.hidden = false; subStyle.hidden = true; }
        postFit();
      }
    });
  }
  render();
  post({ type: 'get-state' });

  // Report both collapsed and expanded sizes once, so the host can resize the
  // window to the exact size before revealing content (no flicker/scrollbar).
  function reportSizes() {
    const collapsed = measureCurrent();
    const style = measureWith(true, false);
    const settings = measureWith(false, true);
    const both = measureWith(true, true);
    const rect = o => {
      const r = o.getBoundingClientRect();
      return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) };
    };
    post({
      type: 'debug-layout',
      innerWidth: window.innerWidth,
      dpr: window.devicePixelRatio || 1,
      menu: rect(menu),
      colors: rect(colorsRoot),
      sizes: rect(sizesRoot),
      collapsed: collapsed,
      style: style,
      settings: settings,
      both: both
    });
    post({ type: 'sizes', collapsed, style, settings, both, innerWidth: window.innerWidth });
    postFit();
  }
  setTimeout(reportSizes, 50);

  menu.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'toggle-style') {
      if (subStyle.hidden) post({ type: 'expand', target: 'style', both: !subSettings.hidden });
      else { subStyle.hidden = true; postFit(); }
      return;
    }
    if (action === 'toggle-settings') {
      if (subSettings.hidden) post({ type: 'expand', target: 'settings', both: !subStyle.hidden });
      else { subSettings.hidden = true; postFit(); }
      return;
    }
    if (action === 'autostart') {
      state.autostart = !state.autostart;
      autostartLabel.textContent = state.autostart ? '开' : '关';
      post({ type: 'autostart', enable: state.autostart });
    } else if (action === 'shortcut') {
      post({ type: 'shortcut' });
    } else if (action === 'uninstall') {
      post({ type: 'uninstall' });
    } else if (action === 'hide') {
      post({ type: 'hide' });
    } else if (action === 'quit') {
      post({ type: 'quit' });
    }
    post({ type: 'close-menu' });
  });

  window.addEventListener('blur', () => post({ type: 'close-menu' }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') post({ type: 'close-menu' }); });
  document.addEventListener('click', e => {
    if (!menu.contains(e.target)) post({ type: 'close-menu' });
  });
})();
