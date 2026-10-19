// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SREY BROWSER COMPONENT — Luxury Web3 Super-App Browser
// Dark glassmorphism search dashboard + smart proxy / reader embed fallback.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function() {
  'use strict';

  const ROOT_ID = 'srey-browser-root';

  const HOME_URL = 'https://sreymara.example';
  const SEARCH_ENGINE = 'https://duckduckgo.com/html/?q=';
  const READER_PREFIX = 'https://r.jina.ai/https://';

  const BOOKMARKS = [
    { title: 'Srey Cinema', url: 'https://cinema.sreymara.example', icon: '🍿' },
    { title: 'VC.Code Editor', url: 'tab:vc', icon: '💻' },
    { title: 'City of Cleveland Permit Portal', url: 'https://aca-prod.accela.com/COC/Cap/CapDetail.aspx?Module=BuildingHousing&TabName=BuildingHousing&capID1=26CAP&capID2=00000&capID3=017NU&agencyCode=COC&IsToShowInspection=', icon: '🏛️' },
    { title: 'Earnings Dashboard', url: 'https://earn.sreymara.example', icon: '💰' },
    { title: 'Token Vault', url: 'https://vault.sreymara.example', icon: '🏛️' },
    { title: 'Srey AI Concierge', url: 'tab:vip', icon: '✨' }
  ];

  const state = {
    mode: 'dashboard',
    tabs: [
      { id: 'tab-1', title: 'Tab 1', url: HOME_URL, favicon: '📄' }
    ],
    activeTabId: 'tab-1',
    history: [HOME_URL],
    histIndex: 0,
    points: 50,
    trx: 0.000,
    watchSeconds: 0,
    timer: null,
    isInitialized: false,
    frameBlocked: false,
    blockedUrl: ''
  };

  function esc(html) {
    return String(html).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":"&#39;",'"':'&quot;'}[c]));
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EARNINGS TICKER — 60s heartbeat keeps the ledger live while browsing
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function creditTick() {
    state.points += 5;
    state.trx = parseFloat((state.trx + 0.005).toFixed(4));
    state.watchSeconds += 60;
    const m = Math.floor(state.watchSeconds / 60);
    const s = state.watchSeconds % 60;
    const timer = document.getElementById('srey-timer');
    if (timer) timer.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    const pe = document.getElementById('srey-points');
    if (pe) pe.textContent = state.points;
    const te = document.getElementById('srey-trx');
    if (te) te.textContent = state.trx.toFixed(4);
    if (window.UrbanCinema && typeof window.UrbanCinema.sendWatchPing === 'function') {
      window.UrbanCinema.sendWatchPing(false);
    }
    try {
      window.dispatchEvent(new CustomEvent('srey_earning_tick', { detail: { points: state.points, trx: state.trx } }));
    } catch (e) { /* CustomEvent unsupported */ }
  }

  function startTicker() {
    if (state.timer) clearInterval(state.timer);
    creditTick();
    state.timer = setInterval(creditTick, 60000);
  }
  function stopTicker() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // URL NORMALIZATION + SEARCH DETECTION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function normalizeInput(input) {
    const v = String(input || '').trim();
    if (!v) return HOME_URL;
    if (/^https?:\/\//i.test(v)) return v;
    if (/^tab:/i.test(v)) return v;
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i.test(v)) return 'https://' + v;
    return SEARCH_ENGINE + encodeURIComponent(v);
  }

  function isSearchUrl(url) {
    return url.indexOf('duckduckgo.com') !== -1 ||
      url.indexOf('bing.com/search') !== -1 ||
      url.indexOf('google.com/search') !== -1;
  }

  function load(input) {
    const target = normalizeInput(input);
    state.currentUrl = target;
    if (target.indexOf('tab:') === 0) {
      const tab = target.slice(4);
      if (window.UrbanCinema && typeof window.UrbanCinema.switchTab === 'function') {
        window.UrbanCinema.switchTab(tab);
      }
      state.mode = 'dashboard';
      render();
      return;
    }
    if (isSearchUrl(target)) {
      state.mode = 'dashboard';
      render();
      return;
    }
    state.mode = 'browser';
    if (!(state.histIndex === state.history.length - 1 && state.history[state.histIndex] === target)) {
      state.history = state.history.slice(0, state.histIndex + 1);
      state.history.push(target);
      state.histIndex = state.history.length - 1;
    }
    render();
  }

  function back() {
    if (state.histIndex > 0) {
      state.histIndex--;
      state.currentUrl = state.history[state.histIndex];
      state.mode = 'browser';
      render();
    }
  }
  function forward() {
    if (state.histIndex < state.history.length - 1) {
      state.histIndex++;
      state.currentUrl = state.history[state.histIndex];
      state.mode = 'browser';
      render();
    }
  }
  function goHome() { load(HOME_URL); }
  function refresh() { render(); }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // IFRAME FALLBACK — swaps in a secure reader view when a site refuses framing
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function onIframeError() {
    const wrap = document.getElementById('srey-viewport-wrap');
    const frame = document.getElementById('srey-webview');
    if (!wrap || !frame) return;
    frame.style.display = 'none';
    if (document.getElementById('srey-fallback')) return;
    const reader = READER_PREFIX + state.currentUrl.replace(/^https?:\/\//, '');
    wrap.insertAdjacentHTML('beforeend',
      '<div class="srey-fallback glass" id="srey-fallback">' +
        '<div class="srey-fallback-icon">⚠</div>' +
        '<div class="srey-fallback-title">Secure Web Viewer</div>' +
        '<div class="srey-fallback-desc">This site blocks direct embedding (x-frame-options / CORS). Open a reader-safe view below instead.</div>' +
        '<div class="srey-fallback-url">' + esc(state.currentUrl) + '</div>' +
        '<a class="srey-btn srey-btn-reader" href="' + esc(reader) + '" target="_blank" rel="noopener">Open Reader View</a>' +
        '<button class="srey-btn srey-btn-search" onclick="window.SreyBrowser.goHome()">Back to Search</button>' +
      '</div>');
    const status = document.getElementById('srey-status');
    if (status) status.textContent = 'Reader fallback: ' + state.currentUrl;
  }

  // Detect "refused to connect" via load timeout / error and trigger the reader fallback.
  function wireIframeFailure() {
    const frame = document.getElementById('srey-webview');
    if (!frame) return;
    let settled = false;
    const timer = setTimeout(function() {
      if (!settled) { settled = true; onIframeError(); }
    }, 6000);
    frame.addEventListener('load', function() { settled = true; clearTimeout(timer); });
    frame.addEventListener('error', function() {
      settled = true;
      clearTimeout(timer);
      onIframeError();
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER — dashboard landing + browser viewport
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function render() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;

    if (state.mode === 'dashboard') {
      root.innerHTML =
        '<div class="srey-dashboard glass">' +
          '<div class="srey-dash-header">' +
            '<div class="srey-brand">' +
              '<span class="srey-brand-mark">S</span>' +
              '<div class="srey-brand-text">' +
                '<div class="srey-brand-name">Srey Browser</div>' +
                '<div class="srey-brand-sub">Luxury Web3 Super-App</div>' +
              '</div>' +
            '</div>' +
            '<div class="srey-dash-earnings">' +
              '<div class="srey-earn-box"><div class="srey-earn-label">Watch Timer</div><div class="srey-earn-val" id="srey-timer">00:00</div></div>' +
              '<div class="srey-earn-box"><div class="srey-earn-label">Points</div><div class="srey-earn-val" id="srey-points">' + state.points + '</div></div>' +
              '<div class="srey-earn-box srey-earn-box-trx"><div class="srey-earn-label">TRX</div><div class="srey-earn-val" id="srey-trx">' + state.trx.toFixed(4) + '</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="srey-search-card glass">' +
            '<div class="srey-search-inner">' +
              '<input class="srey-search-input" id="srey-search-input" placeholder="Search or type a website address" spellcheck="false">' +
              '<button class="srey-btn srey-btn-go" onclick="window.SreyBrowser.goFromBar()">Go</button>' +
            '</div>' +
            '<div class="srey-search-hint">Enter a URL or search query — blocked sites open in a secure reader view automatically.</div>' +
          '</div>' +
          '<div class="srey-tiles">' +
            BOOKMARKS.map(function(b) {
              return '<a class="srey-tile glass" onclick="window.SreyBrowser.load(\'' + esc(b.url) + '\'); return false;" title="' + esc(b.title) + '">' +
                '<div class="srey-tile-icon">' + b.icon + '</div>' +
                '<div class="srey-tile-title">' + esc(b.title) + '</div>' +
                '</a>';
            }).join('') +
          '</div>' +
          '<div class="srey-footer glass">' +
            '<span class="srey-footer-dot"></span>' +
            '<div class="srey-footer-text">60s heartbeat active • 30-min reward engine • 80/20 owner-worker split</div>' +
          '</div>' +
        '</div>';
      startTicker();
    } else {
      renderBrowser(root);
    }
    wireInputs();
  }

  function renderBrowser(root) {
    root.innerHTML =
      '<div class="srey-browser glass">' +
        '<div class="srey-navbar glass">' +
          '<div class="srey-nav-group">' +
            '<button class="srey-btn" title="Back" onclick="window.SreyBrowser.back()" ' + (state.histIndex === 0 ? 'disabled' : '') + '>◀</button>' +
            '<button class="srey-btn" title="Forward" onclick="window.SreyBrowser.forward()" ' + (state.histIndex >= state.history.length - 1 ? 'disabled' : '') + '>▶</button>' +
            '<button class="srey-btn" title="Refresh" onclick="window.SreyBrowser.refresh()">↻</button>' +
            '<button class="srey-btn" title="Home" onclick="window.SreyBrowser.goHome()">⌂</button>' +
          '</div>' +
          '<div class="srey-address-group">' +
            '<input class="srey-address" id="srey-address" type="text" value="' + esc(state.currentUrl) + '" spellcheck="false">' +
            '<button class="srey-btn srey-go" title="Go" onclick="window.SreyBrowser.goFromBar()">Go</button>' +
          '</div>' +
        '</div>' +
        '<div class="srey-viewport-wrap glass" id="srey-viewport-wrap">' +
          '<iframe class="srey-webview" id="srey-webview" src="' + esc(state.currentUrl) + '" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-pointer-lock allow-presentation" referrerpolicy="no-referrer"></iframe>' +
          '<div class="srey-status glass"><span class="srey-status-text" id="srey-status">Embedding ' + esc(state.currentUrl) + '</span></div>' +
        '</div>' +
      '</div>';
    wireIframeFailure();
  }

  function wireInputs() {
    const addr = document.getElementById('srey-address');
    if (addr) {
      addr.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') window.SreyBrowser.goFromBar();
      });
    }
    const sinp = document.getElementById('srey-search-input');
    if (sinp) {
      sinp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') window.SreyBrowser.goFromBar();
      });
    }
  }

  function goFromBar() {
    const input = document.getElementById('srey-search-input') || document.getElementById('srey-address');
    if (input) load(input.value);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PUBLIC API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  window.SreyBrowser = {
    init() {
      state.isInitialized = true;
      render();
    },
    render: render,
    load: load,
    back: back,
    forward: forward,
    refresh: refresh,
    goHome: goHome,
    goFromBar: goFromBar,
    onIframeError: onIframeError,
    startTicker: startTicker,
    stopTicker: stopTicker
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { window.SreyBrowser.init(); });
  } else {
    window.SreyBrowser.init();
  }
})();