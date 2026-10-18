// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SREY BROWSER COMPONENT — Srey Browser Suite
// In-app mini browser: nav bar, address bar, iframe webview, bookmarks.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function() {
  'use strict';

  const ROOT_ID = 'srey-browser-root';

  const HOME_URL = 'https://sreymara.example';
  const BOOKMARKS = [
    { title: 'Srey Cinema', url: 'https://cinema.sreymara.example' },
    { title: 'VIP Lounge', url: 'https://vip.sreymara.example' },
    { title: 'Earnings Dashboard', url: 'https://earn.sreymara.example' },
    { title: 'Token Vault', url: 'https://vault.sreymara.example' }
  ];

  let currentUrl = HOME_URL;
  let history = [HOME_URL];
  let histIndex = 0;
  let isInitialized = false;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function esc(html) {
    return String(html).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'}[c]));
  }

  function load(url) {
    url = String(url || HOME_URL);
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    currentUrl = url;
    if (histIndex === history.length - 1 && history[histIndex] === url) {
      // already current
    } else {
      history = history.slice(0, histIndex + 1);
      history.push(url);
      histIndex = history.length - 1;
    }
    render();
  }
  function back() { if (histIndex > 0) { histIndex--; currentUrl = history[histIndex]; render(); } }
  function forward() { if (histIndex < history.length - 1) { histIndex++; currentUrl = history[histIndex]; render(); } }
  function refresh() { render(); }
  function goHome() { load(HOME_URL); }

  function render() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;

    root.innerHTML = '' +
      '<div class="srey-navbar glass">' +
        '<div class="srey-nav-group">' +
          '<button class="srey-btn" title="Back" onclick="window.SreyBrowser.back()" ' + (histIndex === 0 ? 'disabled' : '') + '>◀</button>' +
          '<button class="srey-btn" title="Forward" onclick="window.SreyBrowser.forward()" ' + (histIndex >= history.length - 1 ? 'disabled' : '') + '>▶</button>' +
          '<button class="srey-btn" title="Refresh" onclick="window.SreyBrowser.refresh()">↻</button>' +
          '<button class="srey-btn" title="Home" onclick="window.SreyBrowser.goHome()">⌂</button>' +
        '</div>' +
        '<div class="srey-address-group">' +
          '<input class="srey-address" id="srey-address" type="text" value="' + esc(currentUrl) + '" spellcheck="false">' +
          '<button class="srey-btn srey-go" title="Go" onclick="window.SreyBrowser.goFromBar()">Go</button>' +
        '</div>' +
      '</div>' +
      '<div class="srey-bookmarks glass">' +
        '<div class="srey-bookmark-list">' +
          BOOKMARKS.map(function(b) {
            return '' +
              '<a class="srey-bookmark" href="' + esc(b.url) + '" onclick="window.SreyBrowser.load(\'' + esc(b.url).replace(/'/g, "\\'") + '\'); return false;" title="' + esc(b.url) + '">' +
              '<span class="srey-bm-icon">★</span>' +
              '<span class="srey-bm-title">' + esc(b.title) + '</span>' +
              '</a>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="srey-viewport glass">' +
        '<iframe class="srey-webview" id="srey-webview" src="' + esc(currentUrl) + '" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-pointer-lock allow-presentation" referrerpolicy="no-referrer"></iframe>' +
        '<div class="srey-status glass"><span class="srey-status-text" id="srey-status">Loaded: ' + esc(currentUrl) + '</span></div>' +
      '</div>';

    const addr = document.getElementById('srey-address');
    if (addr) {
      addr.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { window.SreyBrowser.goFromBar(); }
      });
    }
  }

  function goFromBar() {
    const addr = document.getElementById('srey-address');
    if (addr) load(addr.value);
  }

  window.SreyBrowser = {
    init() {
      if (isInitialized) return;
      isInitialized = true;
      render();
    },
    load: load,
    back: back,
    forward: forward,
    refresh: refresh,
    goHome: goHome,
    goFromBar: goFromBar
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { window.SreyBrowser.init(); });
  } else {
    window.SreyBrowser.init();
  }
})();