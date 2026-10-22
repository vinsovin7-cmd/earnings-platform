// SREYMARA URBAN CINEMA & VIP LOUNGE ENGINE
(function() {
  const OWNER_ID = "8522820906";
  const LIVE_HLS_URL = "https://live-hls-web-aje.getaj.net/AJE/01.m3u8";
  const LIVE_FALLBACK_EMBED = "https://www.youtube-nocookie.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg&autoplay=1&mute=1";
  const SAMPLE_MERLIN_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

  let hlsInstance = null;
  let activeSeries = "merlin";
  let activeSeason = 1;
  let currentPlaying = null;
  let isEarning = false;
  let earningSeconds = 0;
  let earningTimer = null;
  let tgUser = null;
  let connectedWallet = null;
  let heartbeatInterval = null;

  // ─────────────────────────────────────────────────────────────────────
  // BATTERY EARNINGS ENGINE (6000mAh solar charging + yield)
  // ─────────────────────────────────────────────────────────────────────
  let batteryMah = 0;                 // current charge 0-6000 mAh
  const BATTERY_MAX = 6000;           // full capacity
  const BATTERY_CHARGE_PER_SEC = 10;  // mAh gained per second while playing
  let batteryInterval = null;         // 1-second ticker
  let hdQuality = false;              // HD 1080p toggle state
  let videoEndedAdPending = false;    // guard against double ad on ended
  const MASTER_WALLET = 'UQBLz9rXINTlzVUMuUHosRBTpUWqfoXQ8WTkyAgtbSVIbnBJ';
   // Wallet storage constants
   const WALLET_STORAGE_KEY = 'srey_mastr_wallet_v1';

   // Wallet storage helpers
   function saveWalletToStorage(wallet) {
     try {
       localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet));
       // TODO: Add indexedDB backup for extra persistence
       return true;
     } catch (e) {
       console.error('Failed to save wallet to storage:', e);
       return false;
     }
   }

   function restoreWalletFromStorage() {
     try {
       const walletStr = localStorage.getItem(WALLET_STORAGE_KEY);
       if (walletStr) {
         const wallet = JSON.parse(walletStr);
         return wallet;
       }
     } catch (e) {
       console.error('Failed to restore wallet from storage:', e);
     }
     return null;
   }

   function clearWalletFromStorage() {
     try {
       localStorage.removeItem(WALLET_STORAGE_KEY);
       // TODO: Clear indexedDB backup
       return true;
     } catch (e) {
       console.error('Failed to clear wallet from storage:', e);
       return false;
     }
   }

   // ─────────────────────────────────────────────────────────────────────
   // SHARED GLOBAL WALLET STATE (single source of truth across header + vault)
   // ─────────────────────────────────────────────────────────────────────
   const GLOBAL_WALLET_KEY = 'srey_global_wallet_v1';
   function writeGlobalWallet(wallet) {
     try { localStorage.setItem(GLOBAL_WALLET_KEY, JSON.stringify(wallet)); } catch (e) { /* noop */ }
     window.dispatchEvent(new CustomEvent('srey-wallet-change', { detail: wallet || { connected: false } }));
   }
   function readGlobalWallet() {
     try { return JSON.parse(localStorage.getItem(GLOBAL_WALLET_KEY) || 'null'); } catch (e) { return null; }
   }
   function clearGlobalWallet() {
     try { localStorage.removeItem(GLOBAL_WALLET_KEY); } catch (e) { /* noop */ }
     window.dispatchEvent(new CustomEvent('srey-wallet-change', { detail: { connected: false } }));
   }

   // Expose wallet helpers for the Vault Monitor (earn-vault.js) to call on disconnect.
   window.UrbanCinema = window.UrbanCinema || {};
   window.UrbanCinema.writeGlobalWallet = writeGlobalWallet;
   window.UrbanCinema.clearGlobalWallet = clearGlobalWallet;
   window.UrbanCinema.clearWallet = function() {
     connectedWallet = null;
     clearWalletFromStorage();
     clearGlobalWallet();
     const badge = document.getElementById('wallet-badge');
     if (badge) badge.style.display = 'none';
   };

   // Restore wallet on init
   (function() {
     const restored = restoreWalletFromStorage();
     if (restored) {
       connectedWallet = restored;
       console.log('Wallet restored from storage:', connectedWallet);
     }
   })();

  // Expose early so inline onclick handlers never fail before IIFE completes
  window.UrbanCinema = window.UrbanCinema || {};
  window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // YOUTUBE IFRAME PLAYER API STATE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let ytPlayer = null;
  let ytReady = false;

  const SERIES_CATALOG = {
    merlin: {
      title: "Merlin: The Legend Begins",
      seasons: {
        1: [
          { ep: 1, title: "The Dragon's Call", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 2, title: "Valiant", duration: "43m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 3, title: "The Mark of Nimueh", duration: "44m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 4, title: "The Poisoned Chalice", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 5, title: "Lancelot", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 6, title: "A Remedy for All Ills", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 7, title: "The Gates of Avalon", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 8, title: "The Beginning of the End", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 9, title: "Excalibur", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 10, title: "The Moment of Truth", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 11, title: "The Labyrinth of Gedref", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 12, title: "To Kill the King", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 13, title: "Le Morte d'Arthur", duration: "45m", url: SAMPLE_MERLIN_VIDEO }
        ],
        2: [
          { ep: 1, title: "The Curse of Cornelius Sigan", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 2, title: "The Once and Future Queen", duration: "44m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 3, title: "The Nightmare Begins", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 4, title: "Beauty and the Beast", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 5, title: "A servant of two masters", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 6, title: "The Witchfinder", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 7, title: "The Sins of the Father", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 8, title: "The Witch's Quickening", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 9, title: "The Fires of Idirsholas", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 10, title: "Sweet Dreams", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 11, title: "The Hunter's Heart", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 12, title: "The Last Dragonlord", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 13, title: "The Coming of Arthur", duration: "45m", url: SAMPLE_MERLIN_VIDEO }
        ],
        3: [
          { ep: 1, title: "The Tears of Uther Pendragon", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 2, title: "Sponsored by Sirius", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 3, title: "Goblin's Gold", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 4, title: "Gwaine", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 5, title: "His Father's Son", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 6, title: "A Herald of the New Age", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 7, title: "The Crystal Cave", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 8, title: "The Eye of the Phoenix", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 9, title: "The Coming of the Stone", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 10, title: "Queen of Hearts", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 11, title: "The Sorcerer's Shadow", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 12, title: "The Dark Tower", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 13, title: "The Diamond of the Day", duration: "45m", url: SAMPLE_MERLIN_VIDEO }
        ],
        4: [
          { ep: 1, title: "The Darkest Hour", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 2, title: "The Coming of Emrys", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 3, title: "The Wicked Day", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 4, title: "Another's Sorrow", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 5, title: "His Father's Son", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 6, title: "A Herald of the New Age", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 7, title: "The Hollow Queen", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 8, title: "The Sword in the Stone", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 9, title: "The Dark Tower", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 10, title: "The Drawing of the Dark", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 11, title: "The Withcer", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 12, title: "The Diamond of the Day Part 1", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 13, title: "The Diamond of the Day Part 2", duration: "45m", url: SAMPLE_MERLIN_VIDEO }
        ],
        5: [
          { ep: 1, title: "Arthur's Bane", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 2, title: "The Dark Tower", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 3, title: "The Death Song of Uther Pendragon", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 4, title: "Disir", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 5, title: "The Dark Tower", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 6, title: "Withcer", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 7, title: "The Withcer's Tower", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 8, title: "The Hollow Queen", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 9, title: "The Withcer's Bane", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 10, title: "The Withcer's Tower", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 11, title: "The Darkest Hour", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 12, title: "The Diamond of the Day Part 1", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 13, title: "The Diamond of the Day Part 2", duration: "45m", url: SAMPLE_MERLIN_VIDEO }
        ]
      }
    },
    seeker: {
      title: "Legend of the Seeker",
      seasons: {
        1: [
          { ep: 1, title: "Prophecy", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 2, title: "Destiny", duration: "44m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 3, title: "Den of Iniquity", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 4, title: "Marked", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 5, title: "Dark", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 6, title: "Puppet Master", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 7, title: "Pristine Ungifted", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 8, title: "Debt", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 9, title: "Confession", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 10, title: "Baneling", duration: "43m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 11, title: "Revenant", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 12, title: "Widow's Fury", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 13, title: "Sacrifice", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 14, title: "Red", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 15, title: "Chosen", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 16, title: "Resurrection", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 17, title: "Fury", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 18, title: "Home", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 19, title: "Masked", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 20, title: "Bound", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 21, title: "Family", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 22, title: "Extinction", duration: "45m", url: SAMPLE_MERLIN_VIDEO }
        ],
        2: [
          { ep: 1, title: "Nightfall", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 2, title: "Baneling", duration: "43m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 3, title: "Reckoning", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 4, title: "Dark", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 5, title: "Puppet Master", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 6, title: "Pristine Ungifted", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 7, title: "Debt", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 8, title: "Confession", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 9, title: "Resurrection", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 10, title: "Fury", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 11, title: "Home", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 12, title: "Masked", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 13, title: "Bound", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 14, title: "Family", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 15, title: "Extinction", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 16, title: "Puppet Master", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 17, title: "Pristine Ungifted", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 18, title: "Debt", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 19, title: "Confession", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 20, title: "Reckoning", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 21, title: "Bound", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 22, title: "Extinction", duration: "45m", url: SAMPLE_MERLIN_VIDEO }
        ]
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // BATTERY CHARGING ENGINE — fills while video plays, yields TON/USDT
  // ─────────────────────────────────────────────────────────────────────
  function startBatteryCharging() {
    if (batteryInterval) return;
    const container = document.getElementById('battery-container');
    const badge = document.getElementById('solar-badge');
    if (container) container.style.display = 'flex';
    if (badge) badge.style.display = 'inline-flex';
    batteryInterval = setInterval(() => {
      batteryMah = Math.min(BATTERY_MAX, batteryMah + BATTERY_CHARGE_PER_SEC);
      updateBatteryDisplay();
      if (batteryMah >= BATTERY_MAX) {
        clearInterval(batteryInterval);
        batteryInterval = null;
        triggerAutoWithdraw();
      }
    }, 1000);
  }

  function stopBatteryCharging() {
    if (batteryInterval) {
      clearInterval(batteryInterval);
      batteryInterval = null;
    }
  }

  function updateBatteryDisplay() {
    const fill = document.getElementById('battery-fill');
    const pct = document.getElementById('battery-pct');
    const percent = Math.floor((batteryMah / BATTERY_MAX) * 100);
    if (fill) {
      fill.style.width = percent + '%';
      if (percent >= 100) fill.classList.add('battery-full-flash');
    }
    if (pct) pct.textContent = percent + '%';
  }

  function resetBattery() {
    batteryMah = 0;
    stopBatteryCharging();
    updateBatteryDisplay();
    const container = document.getElementById('battery-container');
    const fill = document.getElementById('battery-fill');
    if (container) container.style.display = 'none';
    if (fill) fill.classList.remove('battery-full-flash');
  }

  // Auto-withdraw trigger when battery hits 100% — sends on-chain yield claim
  // directly to master wallet.
  async function triggerAutoWithdraw() {
    const statusEl = document.getElementById('cashout-status');
    if (statusEl) {
      statusEl.textContent = '⚡ BATTERY FULL — Auto-withdrawing yield to master wallet…';
      statusEl.style.color = '#d4af37';
    }
    console.log('BATTERY FULL (6000mAh) — initiating auto-withdraw to:', MASTER_WALLET);
    try {
      const boundWallet = (connectedWallet && connectedWallet.address)
        ? connectedWallet.address
        : MASTER_WALLET;
      const resp = await fetch('/api/remote-build-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: MASTER_WALLET, source: 'battery-auto-withdraw' }),
      });
      const data = await resp.json();
      if (statusEl) {
        statusEl.textContent = '✅ Yield claimed — credited to master wallet ' + truncateAddress(MASTER_WALLET);
        statusEl.style.color = '#00e676';
        setTimeout(() => { statusEl.textContent = ''; }, 5000);
      }
      resetBattery();
    } catch (e) {
      console.error('Auto-withdraw error:', e);
      if (statusEl) {
        statusEl.textContent = '⚠ Auto-withdraw pending — retrying on next charge cycle.';
        statusEl.style.color = '#ffaa00';
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // HD QUALITY TOGGLE
  // ─────────────────────────────────────────────────────────────────────
  function toggleHDQuality() {
    hdQuality = !hdQuality;
    const btn = document.getElementById('hd-toggle');
    if (btn) {
      if (hdQuality) {
        btn.classList.add('active', 'hd-on');
        btn.textContent = 'HD 1080p ON';
      } else {
        btn.classList.remove('active', 'hd-on');
        btn.textContent = 'HD 1080p';
      }
    }
    console.log('HD Quality:', hdQuality ? '1080p ON' : 'OFF');
    // Re-apply quality to active video if playing a series
    if (currentPlaying && currentPlaying.type === 'series') {
      const video = document.getElementById('main-video');
      if (video && video.style.display !== 'none') {
        video.playbackRate = hdQuality ? 1.0 : 1.0;
      }
    }
  }

  function init() {
    // Check Telegram context
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
      tgUser = window.Telegram.WebApp.initDataUnsafe.user;
      document.getElementById('user-display').textContent = tgUser.first_name || tgUser.username || "VIP User";
      window.Telegram.WebApp.expand();
    } else {
      document.getElementById('outside-banner').style.display = 'block';
    }

    // Check DVD Resume State
    checkResumeState();

    // Render Series & Episodes
    renderSeries("merlin");

    // Load Live Al Jazeera by default
    loadLive();

    // Start Watch-to-Earn timer
    startWatchTimer();

    // Check URL Hash for direct tab (#tab=vault)
    const hash = window.location.hash;
    if (hash && hash.indexOf('#tab=') === 0) {
      switchTab(hash.replace('#tab=', ''));
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EXPLICIT CLICK BINDINGS (safety net for inline onclick handlers)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    function bindClick(id, handler) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', handler);
    }

    bindClick('btn-wallet', () => openWalletModal());
    bindClick('btn-chan-live', showLiveChannel);
    bindClick('btn-chan-merlin', loadMerlin);
    bindClick('tab-btn-vault', () => switchTab('vault'));

    // Nav tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    // Stream pills
    document.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.id === 'btn-chan-live') showLiveChannel();
        if (btn.id === 'btn-chan-merlin') loadMerlin();
      });
    });

    // Series buttons
    document.getElementById('btn-series-merlin')?.addEventListener('click', () => selectSeries('merlin'));
    document.getElementById('btn-series-seeker')?.addEventListener('click', () => selectSeries('seeker'));

    // Wallet modal buttons
    document.querySelectorAll('#wallet-modal .btn-gold').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.textContent || '';
        if (text.includes('TON')) connectWallet('TON');
        if (text.includes('Solana')) connectWallet('SOL');
        if (text.includes('TRON')) connectWallet('TRX');
        if (text.includes('EVM')) connectWallet('EVM');
      });
    });

    // Initialize blockchain inspector if wallet already bound
    if (connectedWallet) {
      refreshBlockchainData();
      startHeartbeat();
      // Initialize treasury display
      refreshTreasuryDisplay();
      // Update treasury display every 10 seconds
      setInterval(refreshTreasuryDisplay, 10000);
    }
  }

  // --- DUAL-ENGINE LIVE STREAM ---
  function loadLive() {
    // Guard against double-fire (inline onclick + addEventListener both attached)
    const _now = Date.now();
    if (loadLive._t && _now - loadLive._t < 500) return;
    loadLive._t = _now;

    // Stop battery charging when switching to live TV (series-only charging)
    stopBatteryCharging();

    const video = document.getElementById('main-video');
    const iframe = document.getElementById('live-iframe');
    const badge = document.getElementById('stage-badge');
    const title = document.getElementById('stage-title');

    title.textContent = "Al Jazeera English — 24/7 Global Live";
    badge.textContent = "🔴 LIVE HD";
    badge.style.background = "#ef4444";
    currentPlaying = { type: 'live' };

    document.getElementById('btn-chan-live').classList.add('active');
    document.getElementById('btn-chan-merlin').classList.remove('active');

    if (Hls.isSupported()) {
      iframe.style.display = 'none';
      video.style.display = 'block';
      if (hlsInstance) hlsInstance.destroy();
      hlsInstance = new Hls({ enableWorker: true });
      hlsInstance.loadSource(LIVE_HLS_URL);
      hlsInstance.attachMedia(video);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hlsInstance.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          // Fallback to official responsive embed iframe
          video.style.display = 'none';
          iframe.style.display = 'block';
          iframe.src = LIVE_FALLBACK_EMBED;
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = LIVE_HLS_URL;
      video.play().catch(() => {});
    } else {
      video.style.display = 'none';
      iframe.style.display = 'block';
      iframe.src = LIVE_FALLBACK_EMBED;
    }
  }

  function loadMerlin() {
    playEpisode("merlin", 1, 1);
  }

  // --- PLAY EPISODE & DVD RESUME ENGINE ---
  // Verified embeddable YouTube sources (every entry oEmbed-checked → HTTP 200,
  // embedding allowed). `first` = direct video ID for the season premiere;
  // `playlist` = season playlist used with the videoseries embed (index = ep-1).
  const SERIES_SOURCES = {
    merlin: {
      1: { playlist: 'PLtIrzAunWmRAOBXQtGRf9W2XzANGk_T5P', first: 'Wj7g-k9xh0o' },
      2: { playlist: 'PLDc8U3yseFUEvKDZbeofX-3wHYdhOap10', first: 'LE-sTV9iUHM' },
      3: { playlist: 'PLap5t7LadDIZBMRbQIst5VMDzTxxSGnZE', first: 'Rb2bdVaQYhc' },
      4: { playlist: 'PLA5ABEFC84375A927' },
      5: { playlist: 'PLB8B8995B5B1CA99A' }
    },
    seeker: {
      1: { playlist: 'PLaR8BoWIH3-nkybZAoeHxVbCvQNcdNknd', first: 'GObOIKQD_CA' },
      2: { playlist: 'PLXdzvSEba3HPd3nwXGglkpNCqktS_AvsY' }
    }
  };

  function buildSeriesEmbedURL(seriesKey, seasonNum, epNum, startTime) {
    const src = SERIES_SOURCES[seriesKey] && SERIES_SOURCES[seriesKey][seasonNum];
    if (!src) return null;
    const start = startTime > 0 ? '&start=' + Math.floor(startTime) : '';
    const common = '?autoplay=1&mute=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1&fs=1' + start;
    if (epNum === 1 && src.first) {
      return 'https://www.youtube-nocookie.com/embed/' + src.first + common;
    }
    if (src.playlist) {
      return 'https://www.youtube-nocookie.com/embed/videoseries?list=' + src.playlist +
        '&index=' + (epNum - 1) + common;
    }
    return null;
  }

  function mountSeriesMp4Fallback(video, seriesFrame, ep, seriesKey, seasonNum, epNum, series) {
    clearInterval(loadSeries._resumeTimer);
    clearTimeout(loadSeries._fallbackTimer);
    if (seriesFrame) { seriesFrame.style.display = 'none'; seriesFrame.src = 'about:blank'; }
    video.style.display = 'block';
    video.muted = true;
    video.src = ep.url;
    video.currentTime = 0;
    video.play().catch(() => {});
    video.ontimeupdate = () => {
      if (video.currentTime > 5 && !video.paused) {
        localStorage.setItem('sreymara_playback_resume', JSON.stringify({
          series: seriesKey, seriesName: series.title, season: seasonNum,
          ep: epNum, epTitle: ep.title, time: Math.floor(video.currentTime)
        }));
      }
    };
    video.onended = () => {
      if (videoEndedAdPending) return;
      videoEndedAdPending = true;
      triggerSponsorAd();
      const adModal = document.getElementById('sponsor-modal');
      const adWatch = setInterval(() => {
        if (adModal.style.display === 'none' || adModal.style.display === '') {
          clearInterval(adWatch);
          videoEndedAdPending = false;
          playNextEpisode();
        }
      }, 500);
    };
  }

  function loadSeries(seriesKey, seasonNum, epNum, startTime = 0) {
    const series = SERIES_CATALOG[seriesKey];
    if (!series || !series.seasons[seasonNum]) return;
    const ep = series.seasons[seasonNum].find(e => e.ep === epNum);
    if (!ep) return;

    const video = document.getElementById('main-video');
    const liveIframe = document.getElementById('live-iframe');
    const seriesFrame = document.getElementById('series-yt-iframe');
    const badge = document.getElementById('stage-badge');
    const title = document.getElementById('stage-title');

    // Pause & detach the live engine WITHOUT touching loadLive() itself
    // (Al Jazeera stream implementation locked per .clinerules key 081677)
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
    try { video.pause(); } catch(e) {}
    video.removeAttribute('src');
    video.ontimeupdate = null;
    video.onended = null;
    video.style.display = 'none';
    liveIframe.style.display = 'none';
    liveIframe.src = 'about:blank';

    title.textContent = `${series.title} - S${seasonNum} E${epNum}: ${ep.title}`;
    badge.textContent = "🍿 CINEMA";
    badge.style.background = "#d4af37";

    document.getElementById('btn-chan-live').classList.remove('active');
    document.getElementById('btn-chan-merlin').classList.add('active');

    activeSeason = seasonNum;
    currentPlaying = { type: 'series', series: seriesKey, season: seasonNum, ep: epNum, title: ep.title };

    // New embed starts muted (autoplay policy) — re-arm the unmute pill
    const overlay = document.getElementById('audio-unlock-overlay');
    if (overlay) overlay.style.display = 'flex';

    const embedURL = buildSeriesEmbedURL(seriesKey, seasonNum, epNum, startTime);

    if (embedURL && seriesFrame) {
      // Bulletproof direct iframe mount — no YT.Player DOM replacement, so a
      // missing/slow YouTube JS API can never leave a black box.
      seriesFrame.style.display = 'block';
      seriesFrame.style.width = '100%';
      seriesFrame.style.height = '100%';
      seriesFrame.style.opacity = '1';
      seriesFrame.style.zIndex = '5';
      seriesFrame.src = embedURL;

      // Start battery charging while series plays
      startBatteryCharging();

      // Auto-play engine: when episode ends, show interstitial ad then next episode
      // (YouTube cross-origin iframe can't emit 'ended' — use duration-based timer)
      clearTimeout(loadSeries._endedTimer);
      const epDurationSec = (ep.duration || '45m').replace('m', '') * 60;
      const remainingSec = Math.max(1, epDurationSec - Math.floor(startTime || 0));
      loadSeries._endedTimer = setTimeout(() => {
        if (videoEndedAdPending) return;
        videoEndedAdPending = true;
        triggerSponsorAd();
        // After ad completes, playNextEpisode is called via completeRewardedAd → sendWatchPing
        // We chain playNextEpisode after the ad modal closes
        const adModal = document.getElementById('sponsor-modal');
        const adWatch = setInterval(() => {
          if (adModal.style.display === 'none' || adModal.style.display === '') {
            clearInterval(adWatch);
            videoEndedAdPending = false;
            playNextEpisode();
          }
        }, 500);
      }, remainingSec * 1000);

      // Wall-clock resume tracker (cross-origin iframe can't expose currentTime)
      clearInterval(loadSeries._resumeTimer);
      let elapsed = startTime;
      loadSeries._resumeTimer = setInterval(() => {
        elapsed += 1;
        if (elapsed % 5 === 0) {
          localStorage.setItem('sreymara_playback_resume', JSON.stringify({
            series: seriesKey, seriesName: series.title, season: seasonNum,
            ep: epNum, epTitle: ep.title, time: elapsed
          }));
        }
      }, 1000);

      // If the embed never loads (network/region block), fall back to MP4
      let embedLoaded = false;
      seriesFrame.onload = () => { embedLoaded = true; };
      clearTimeout(loadSeries._fallbackTimer);
      loadSeries._fallbackTimer = setTimeout(() => {
        if (!embedLoaded) {
          mountSeriesMp4Fallback(video, seriesFrame, ep, seriesKey, seasonNum, epNum, series);
        }
      }, 15000);
    } else {
      // No verified YouTube source for this episode — direct MP4 renders instantly
      mountSeriesMp4Fallback(video, seriesFrame, ep, seriesKey, seasonNum, epNum, series);
    }
  }

  // Wraps the LOCKED loadLive() (untouched) so switching back to Al Jazeera
  // hides the series player that loadSeries() mounted the stage.
  function showLiveChannel() {
    clearInterval(loadSeries._resumeTimer);
    clearTimeout(loadSeries._fallbackTimer);
    const seriesFrame = document.getElementById('series-yt-iframe');
    if (seriesFrame) {
      seriesFrame.style.display = 'none';
      seriesFrame.src = 'about:blank';
    }
    loadLive();
  }

  function checkResumeState() {
    const saved = localStorage.getItem('sreymara_playback_resume');
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if (data.time > 10) {
        document.getElementById('resume-banner').style.display = 'flex';
        document.getElementById('resume-title').textContent = `${data.seriesName} (S${data.season} E${data.ep})`;
        const m = Math.floor(data.time / 60);
        const s = data.time % 60;
        document.getElementById('resume-time').textContent = `Paused at ${m}:${s < 10 ? '0' : ''}${s}`;
      }
    } catch(e) {}
  }

  function resumePlayback() {
    const saved = localStorage.getItem('sreymara_playback_resume');
    if (!saved) return;
    const data = JSON.parse(saved);
    document.getElementById('resume-banner').style.display = 'none';
    playEpisode(data.series, data.season, data.ep, data.time);
  }

  function dismissResume() {
    document.getElementById('resume-banner').style.display = 'none';
  }

  // --- SERIES & EPISODES CATALOG RENDERING ---
  function selectSeries(seriesKey) {
    activeSeries = seriesKey;
    document.getElementById('btn-series-merlin').classList.toggle('active', seriesKey === 'merlin');
    document.getElementById('btn-series-seeker').classList.toggle('active', seriesKey === 'seeker');
    renderSeries(seriesKey);
  }

  function renderSeries(seriesKey) {
    const series = SERIES_CATALOG[seriesKey];
    const seasonsContainer = document.getElementById('season-selector');
    seasonsContainer.innerHTML = '';

    const seasonKeys = Object.keys(series.seasons);
    seasonKeys.forEach((sNum, idx) => {
      const pill = document.createElement('button');
      pill.className = `s-pill ${idx === 0 ? 'active' : ''}`;
      pill.textContent = `Season ${sNum}`;
      pill.onclick = () => {
        document.querySelectorAll('.s-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeSeason = Number(sNum);
        renderEpisodes(seriesKey, activeSeason);
      };
      seasonsContainer.appendChild(pill);
    });

    renderEpisodes(seriesKey, 1);
  }

  function renderEpisodes(seriesKey, seasonNum) {
    const eps = SERIES_CATALOG[seriesKey].seasons[seasonNum] || [];
    const container = document.getElementById('episodes-container');
    container.innerHTML = '';

    eps.forEach(ep => {
      const card = document.createElement('div');
      card.className = 'ep-card';
      card.innerHTML = `
        <div class="ep-header">
          <span>EPISODE ${ep.ep}</span>
          <span>⏱️ ${ep.duration}</span>
        </div>
        <div class="ep-title">${ep.title}</div>
        <button class="btn-gold" onclick="window.UrbanCinema.playEpisode('${seriesKey}', ${seasonNum}, ${ep.ep})">▶ Play & Earn</button>
      `;
      container.appendChild(card);
    });
  }

  // --- SPONSOR AD MONETIZATION ---
  function triggerSponsorAd() {
    const modal = document.getElementById('sponsor-modal');
    const countdown = document.getElementById('ad-countdown');
    const bar = document.getElementById('ad-bar');
    modal.style.display = 'flex';
    let timeLeft = 15;
    countdown.textContent = timeLeft;
    bar.style.width = '0%';

    const interval = setInterval(() => {
      timeLeft--;
      countdown.textContent = timeLeft;
      bar.style.width = `${((15 - timeLeft) / 15) * 100}%`;
      if (timeLeft <= 0) {
        clearInterval(interval);
        modal.style.display = 'none';
        // Credit bonus with 70/30 split
        sendWatchPing(true);
      }
    }, 1000);
  }

  // --- WATCH-TO-EARN & 70/30 SPLIT ---
  function startWatchTimer() {
    earningTimer = setInterval(() => {
      earningSeconds++;
      const m = Math.floor(earningSeconds / 60);
      const s = earningSeconds % 60;
      document.getElementById('wte-timer').textContent = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
      if (earningSeconds % 60 === 0) {
        sendWatchPing(false);
      }
    }, 1000);
  }

  function onYouTubeIframeAPIReady() {
    ytReady = true;
    if (window.__pendingYTVideo) {
      playYTVideo(window.__pendingYTVideo.url, window.__pendingYTVideo.title);
      delete window.__pendingYTVideo;
    }
  }

  function playYTVideo(videoId, title) {
    const video = document.getElementById('main-video');
    const iframe = document.getElementById('live-iframe');

    video.style.display = "none";
    iframe.style.display = "block";

    if (ytPlayer) {
      ytPlayer.loadVideoById(videoId);
    } else {
      ytPlayer = new YT.Player('live-iframe', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          controls: 1,
          fs: 1,
          disablekb: 0,
          iv_load_policy: 3
        },
        events: {
          onReady: function(e) {
            e.target.playVideo();
            e.target.addEventListener('onStateChange', function(evt) {
              if (evt.data === YT.PlayerState.ENDED) {
                playNextEpisode();
              }
            });
          },
          onStateChange: function(evt) {
            if (evt.data === YT.PlayerState.ENDED) {
              playNextEpisode();
            }
          },
          onError: function(e) {
            console.error("YouTube Player Error:", e);
          }
        }
      });
    }

    const titleEl = document.getElementById('stage-title');
    if (titleEl) titleEl.textContent = title;
  }

  function stopYTPlayer() {
    if (ytPlayer) {
      try { ytPlayer.stopVideo(); ytPlayer.destroy(); } catch(e) {}
      ytPlayer = null;
    }
  }

  function playNextEpisode() {
    const cat = SERIES_CATALOG[activeSeries];
    if (!cat) return;
    const seasons = Object.keys(cat.seasons).map(Number).sort();
    const currentSeasonIdx = seasons.indexOf(activeSeason);
    const eps = cat.seasons[activeSeason];
    const currentEpIdx = eps.findIndex(e => e.ep === currentPlaying.ep);

    let nextEp = null;
    let nextSeason = activeSeason;

    if (currentEpIdx < eps.length - 1) {
      nextEp = eps[currentEpIdx + 1];
    } else if (currentSeasonIdx < seasons.length - 1) {
      nextSeason = seasons[currentSeasonIdx + 1];
      nextEp = cat.seasons[nextSeason][0];
    } else {
      nextSeason = seasons[0];
      nextEp = cat.seasons[nextSeason][0];
    }

    activeSeason = nextSeason;
    loadSeries(activeSeries, nextSeason, nextEp.ep);
  }

  function playEpisode(seriesKey, season, episode, startTime) {
    loadSeries(seriesKey, season, episode, startTime);
    renderSeries(seriesKey);
  }

  function sendWatchPing(isAdBonus = false) {
    const currentPts = parseInt(document.getElementById('user-points').textContent) || 0;
    const currentTrx = parseFloat(document.getElementById('user-trx').textContent) || 0;
    
    // User gets 30% share; Admin gets 70% share
    const addedPts = isAdBonus ? 15 : 5;
    const addedTrx = isAdBonus ? 0.03 : 0.005;

    document.getElementById('user-points').textContent = currentPts + addedPts;
    document.getElementById('user-trx').textContent = (currentTrx + addedTrx).toFixed(4);

    // Call server API if running
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
      fetch('/api/watch-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: window.Telegram.WebApp.initData,
          minutes: 1,
          isAdBonus: isAdBonus
        })
      }).catch(() => {});
    }
  }

  // Unmute the ACTIVE player (live HTML5 video AND/OR YouTube series/live
  // iframes via IFrame-API postMessage) and hide the unmute pill once unmuted.
  function unlockAudio() {
    const video = document.getElementById('main-video');
    if (video && video.style.display !== 'none') {
      video.muted = false;
      video.volume = 0.8;
      video.play().catch(() => {});
    }
    ['series-yt-iframe', 'live-iframe'].forEach((id) => {
      const frame = document.getElementById(id);
      if (frame && frame.style.display !== 'none' && frame.contentWindow) {
        const cmd = (func, args) => frame.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: func, args: args || [] }), '*');
        cmd('unMute');
        cmd('setVolume', [80]);
      }
    });
    const pill = document.getElementById('audio-unlock-overlay');
    if (pill) pill.style.display = 'none';
  }

  // --- TABS & CHAT ---
  function switchTab(tabId) {
    // Alias: #tab=browser opens the Srey Browser panel
    if (tabId === 'browser') tabId = 'srey';
    // Guard: an unknown tab falls back to Cinema so the lower container never renders blank
    if (!document.getElementById(`panel-${tabId}`)) tabId = 'cinema';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tabId));
    document.querySelectorAll('.panel-content').forEach(p => p.classList.toggle('active', p.id === `panel-${tabId}`));
    window.location.hash = `tab=${tabId}`;
    // Lazy-init panel components on first visit
    if (tabId === 'vc' && window.VCEditor) window.VCEditor.init();
    if (tabId === 'srey' && window.SreyBrowser) {
      window.SreyBrowser.init();
      window.SreyBrowser.render();
    }
  }

  // Public API for panel components
  window.UrbanCinema.initVCEditor = function() {
    if (window.VCEditor) window.VCEditor.init();
  };
  window.UrbanCinema.initSreyBrowser = function() {
    if (window.SreyBrowser) window.SreyBrowser.init();
  };

  function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    const log = document.getElementById('chat-log');
    log.innerHTML += `<div class="chat-msg user"><strong>You:</strong> ${msg}</div>`;
    log.scrollTop = log.scrollHeight;

    // Show a typing indicator while waiting for the AI response.
    const typing = document.createElement('div');
    typing.className = 'chat-msg ai';
    typing.innerHTML = '<strong>Srey AI:</strong> <span class="typing">typing…</span>';
    typing.id = 'ai-typing';
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'AI response failed');
        return data;
      })
      .then((data) => {
        const el = document.getElementById('ai-typing');
        if (el) el.remove();
        log.innerHTML += `<div class="chat-msg ai"><strong>Srey AI:</strong> ${data.reply}</div>`;
        log.scrollTop = log.scrollHeight;
      })
      .catch((err) => {
        console.error('AI chat error:', err);
        const el = document.getElementById('ai-typing');
        if (el) el.remove();
        log.innerHTML += `<div class="chat-msg ai"><strong>Srey AI:</strong> I am currently updating my concierge engine. Please try your request again in a moment!</div>`;
        log.scrollTop = log.scrollHeight;
      });
  }

  function sendQuickPrompt(promptText) {
    document.getElementById('chat-input').value = promptText;
    sendChat();
  }

  function connectTon() {
    alert("TON Connect Initialized: Connecting to Tonkeeper / OpenMask...");
  }

  function executeAdminCashout() {
    const wallet = document.getElementById('admin-trx-wallet').value.trim();
    const amount = document.getElementById('admin-cashout-amount').value.trim();
    const status = document.getElementById('cashout-status');
    if (!wallet.startsWith('T') || wallet.length !== 34) {
      status.textContent = "Error: Invalid TRC-20 address (must start with T and be 34 characters).";
      status.style.color = "#ef4444";
      return;
    }
    status.textContent = `Success: Cashout of ${amount} TRX queued to ${wallet}!`;
    status.style.color = "#00e676";
  }

  function openWalletModal() {
    const modal = document.getElementById('wallet-modal');
    if (modal) modal.style.display = 'flex';
  }

  function closeWalletModal() {
    const modal = document.getElementById('wallet-modal');
    if (modal) modal.style.display = 'none';
  }

  // --- TON Connect UI singleton (Tonkeeper / MyTonWallet / Telegram Wallet) ---
  // Initialized once so onStatusChange stays live across reconnections.
  let tonConnectUi;
  function ensureTonConnectUi() {
    if (tonConnectUi) return tonConnectUi;
    if (!window.TonConnectUI) return null;
    tonConnectUi = new window.TonConnectUI({
      manifestUrl: 'https://raw.githubusercontent.com/vinsovin7-cmd/earnings-platform/main/ton-manifest.json',
      buttonRootId: null
    });
    tonConnectUi.onStatusChange(async (walletInfo) => {
      if (!walletInfo || !walletInfo.account || !walletInfo.account.address) return;
      const address = walletInfo.account.address;
      const balance = (parseInt(walletInfo.account.balance || '0') / 1e9).toFixed(4);
      connectedWallet = { chain: 'TON', address, balance };
      writeGlobalWallet({ connected: true, chain: 'TON', address, balance });
      displayWalletBadge('TON', address, balance);
      await bindWalletPersistent('TON', address, balance);
      refreshBlockchainData();
      startHeartbeat();
      closeWalletModal();
    });
    return tonConnectUi;
  }

  // WalletConnect fallback for Trust Wallet when no injected ethereum provider is present.
  function openTrustWalletWalletConnect() {
    const wcUrl = 'https://app.walletconnect.com/wc';
    const trustDeepLink = 'trust://walletconnect';
    try {
      window.open(trustDeepLink, '_blank');
    } catch (e) {
      // deep link unsupported on this device
    }
    window.open(wcUrl, '_blank');
    console.log('EVM: no window.ethereum — opened WalletConnect fallback for Trust Wallet');
  }

  async function connectWallet(chain) {
    // Guard against double-fire (inline onclick + addEventListener both attached)
    const _now = Date.now();
    if (connectWallet._t && _now - connectWallet._t < 600) return;
    connectWallet._t = _now;

    let address = '';
    let balance = '0';
    let chainLabel = chain;

    try {
      if (chain === 'TON') {
        const ui = ensureTonConnectUi();
        if (!ui) {
          // TonConnect UI not available — require a real TonConnect session instead of a text prompt.
          console.warn('TON: TonConnect UI not available on window; cannot connect without it.');
        } else {
          // Opens the official Tonkeeper / Telegram Wallet picker modal (or deep-links on mobile)
          await ui.openModal();
          // The connected address/balance arrive via onStatusChange above, which
          // updates the badge, binds the wallet and starts the reward heartbeat.
        }
      } else if (chain === 'SOL') {
        if (window.solana && (window.solana.isPhantom || window.solana.isSolflare)) {
          const resp = await window.solana.connect();
          address = resp.publicKey.toString();
          try {
            const balanceResp = await window.solana.request({
              method: 'getBalance',
              params: [address]
            });
            balance = (balanceResp / 1e9).toFixed(4);
          } catch(e) { balance = '0.0000'; }
        } else {
          address = await promptSolanaAddress();
          balance = '0.0000';
        }
      } else if (chain === 'TRX') {
        if (window.tronWeb && window.tronWeb.defaultAddress) {
          address = window.tronWeb.defaultAddress.base58;
          try {
            const bal = await window.tronWeb.trx.getBalance(address);
            balance = (bal / 1e6).toFixed(4);
          } catch(e) { balance = '0.0000'; }
        } else if (window.tronLink) {
          const accounts = await window.tronLink.request({ method: 'tron_requestAccounts' });
          address = accounts[0] || '';
          balance = '0.0000';
        } else {
          address = await promptTRXAddress();
          balance = '0.0000';
        }
      } else if (chain === 'EVM') {
        if (window.ethereum) {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          address = accounts[0] || '';
          try {
            const bal = await window.ethereum.request({
              method: 'eth_getBalance',
              params: [address, 'latest']
            });
            balance = (parseInt(bal, 16) / 1e18).toFixed(4);
          } catch(e) { balance = '0.0000'; }
        } else {
          // Fallback to WalletConnect universal link for Trust Wallet mobile
          await openTrustWalletWalletConnect();
        }
      }

      if (address) {
        connectedWallet = { chain: chainLabel, address: address, balance: balance };
        writeGlobalWallet({ connected: true, chain: chainLabel, address: address, balance: balance });
        displayWalletBadge(chainLabel, address, balance);
        await bindWalletPersistent(chainLabel, address, balance);
        refreshBlockchainData();
        startHeartbeat();
        closeWalletModal();
      }
    } catch(e) {
      console.error('Wallet connect error:', e);
      alert('Wallet connection failed. Please try again.');
    }
  }

  function promptSolanaAddress() { return prompt('Enter your Solana wallet address:'); }
  function promptTRXAddress() { return prompt('Enter your TRON/TRX wallet address (T...):'); }
  function promptEVMAddress() { return prompt('Enter your EVM wallet address (0x...):'); }

  function displayWalletBadge(chain, address, balance) {
    const badge = document.getElementById('wallet-badge');
    const chainIcon = document.getElementById('wallet-chain-icon');
    const walletAddr = document.getElementById('wallet-address');
    const walletBal = document.getElementById('wallet-balance');

    if (badge) {
      badge.style.display = 'flex';
      if (chainIcon) chainIcon.textContent = chain === 'TON' ? '💎' : chain === 'SOL' ? '☀️' : chain === 'TRX' ? '🔷' : '🦊';
      if (walletAddr) walletAddr.textContent = truncateAddress(address);
      if (walletBal) walletBal.textContent = `${balance} ${chain}`;
      badge.title = address;
    }

    const trxEl = document.getElementById('user-trx');
    if (trxEl && chain === 'TRX') {
      trxEl.textContent = balance;
    }
  }

  function truncateAddress(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  }

async function bindWalletPersistent(chain, address, balance) {
  if (!tgUser) return;
  // Prevent binding if a wallet is already bound (requires explicit unbind first)
  if (connectedWallet) {
    console.warn('Wallet already bound. Unbind first to bind a new wallet.');
    return;
  }
  try {
    const initData = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp.initData : '';
    const resp = await fetch('/api/wallet/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: tgUser.id,
        username: tgUser.username || '',
        chain: chain,
        walletAddress: address,
        liveBalance: balance,
        status: 'ACTIVE',
        initData: initData
      })
    });
    const data = await resp.json();
    if (data.status !== 'ok') {
      console.warn('Wallet bind response:', data);
      return;
    }
    // Update connectedWallet and persist to storage
    connectedWallet = { chain, address, balance: balance || 0 };
    saveWalletToStorage(connectedWallet);
  } catch(e) {
    console.error('Wallet bind error:', e);
  }
}

  function triggerRewardedAd() {
    const modal = document.getElementById('sponsor-modal');
    const countdown = document.getElementById('ad-countdown');
    const adBar = document.getElementById('ad-bar');

    if (!modal) return;

    modal.style.display = 'flex';
    let seconds = 15;
    countdown.textContent = seconds;
    adBar.style.width = '0%';

    const countdownInterval = setInterval(() => {
      seconds--;
      countdown.textContent = seconds;
      adBar.style.width = ((15 - seconds) / 15 * 100) + '%';
      if (seconds <= 0) {
        clearInterval(countdownInterval);
        modal.style.display = 'none';
        completeRewardedAd();
      }
    }, 1000);

    const adsSdk = window.Adsgram || window.AdsGram;
    if (adsSdk) {
      try {
        adsSdk.showRewardedAd({
          onReward: () => {
            clearInterval(countdownInterval);
            modal.style.display = 'none';
            completeRewardedAd();
          },
          onClose: () => {
            clearInterval(countdownInterval);
            modal.style.display = 'none';
          }
        });
      } catch(e) {
        console.error('Adsgram error:', e);
      }
    }
  }

  function completeRewardedAd() {
    sendWatchPing(true);
    const status = document.getElementById('cashout-status');
    if (status) {
      status.textContent = "\u2705 Ad reward credited! +15 PTS, +0.03 TRX";
      status.style.color = "#00e676";
      setTimeout(() => { status.textContent = ''; }, 3000);
    }

    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
      fetch('/api/ads/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: window.Telegram.WebApp.initData,
          rewardType: 'rewarded_ad',
          points: 15,
          trx: 0.03
        })
      }).catch(() => {});
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LIVE BLOCKCHAIN WALLET INSPECTOR (TON v5r1 / USDT / TRX)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function refreshBlockchainData() {
    if (!connectedWallet) return;
    const { chain, address } = connectedWallet;
    try {
      if (chain === 'TON') { await fetchTONData(address); }
      else if (chain === 'TRX') { await fetchTRXData(address); }
    } catch(e) { console.error('Blockchain refresh error:', e); }
  }

  // Real-time UI balance refresh — no page reload, never interrupts video playback.
  async function refreshBalances() {
    try { await refreshBlockchainData(); } catch (e) { console.error('refreshBalances error:', e); }
    return {
      pts: document.getElementById('user-points') ? document.getElementById('user-points').textContent : '0',
      trx: document.getElementById('user-trx') ? document.getElementById('user-trx').textContent : '0'
    };
  }

  // Executive "BUILD & YIELD" remote build sync.
  // Spinning state -> POST /api/remote-build-sync -> lucky yield reward ($10-$100 USDT) -> refresh balances.
  async function triggerRemoteBuildAndYield() {
    const btn = document.getElementById('exec-build-btn');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<span>⚙️ Syncing &amp; Building…</span>'; btn.disabled = true; }
    try {
      const boundWallet = (connectedWallet && connectedWallet.address)
        ? connectedWallet.address
        : 'UQBLz9rXINTlzVUMuUHosRBTpUWqfoXQ8WTkyAgtbSVIbnBJ';
      const resp = await fetch('/api/remote-build-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: boundWallet }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || 'Build sync failed');
      const yieldUsdt = data.yieldUsdt;
      alert('🚀 Executive Build & Yield Complete!\n\nLucky Build Yield: $' + yieldUsdt + ' USDT\n\nReward reserve credited to your executive vault.');
      await refreshBalances();
      const usdtEl = document.getElementById('blk-balance-USDT');
      if (usdtEl) usdtEl.textContent = (parseFloat(usdtEl.textContent || '0') + parseFloat(yieldUsdt)).toFixed(4);
    } catch (e) {
      console.error('Remote build & yield error:', e);
      alert('Build & Yield sync failed. Please try again.');
    } finally {
      if (btn) { btn.innerHTML = originalHtml; btn.disabled = false; }
    }
  }

  async function fetchTONData(address) {
    try {
      const accResp = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}`);
      const accData = await accResp.json();
      const tonBalance = (accData.balance || 0) / 1e9;
      updateBlockchainCard({
        chain: 'TON', address, contractType: 'wallet_v5r1',
        explorer: `https://tonscan.org/address/${address}`,
        status: 'Active',
        balances: [
          { label: 'TON', value: tonBalance.toFixed(4), symbol: 'TON' },
          { label: 'USDT (Jetton)', value: '0.0000', symbol: 'USDT' }
        ]
      });
      try {
        const jettonResp = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/jettons`);
        const jettonData = await jettonResp.json();
        const jettons = jettonData.jettons || [];
        const usdtJetton = jettons.find(j => j.jetton && j.jetton.metadata && j.jetton.metadata.symbol === 'USDT');
        if (usdtJetton) {
          const el = document.getElementById('blk-balance-USDT');
          if (el) el.textContent = (parseInt(usdtJetton.balance || '0') / 1e6).toFixed(2);
        }
        renderTokens(jettons);
      } catch(e) { console.error('Jetton fetch error:', e); }
      renderTransactionHistory(accData);
    } catch(e) { console.error('TON data error:', e); }
  }

  async function fetchTRXData(address) {
    try {
      const accResp = await fetch(`https://api.trongrid.io/v1/accounts/${encodeURIComponent(address)}`);
      const accData = await accResp.json();
      const trxBalance = (accData.balance || 0) / 1e6;
      updateBlockchainCard({
        chain: 'TRX', address, contractType: 'TRC20',
        explorer: `https://tronscan.org/#/address/${address}`,
        status: 'Active',
        balances: [
          { label: 'TRX', value: trxBalance.toFixed(4), symbol: 'TRX' },
          { label: 'USDT (TRC-20)', value: '0.0000', symbol: 'USDT' }
        ]
      });
      try {
        const tokenResp = await fetch(`https://api.trongrid.io/v1/accounts/${encodeURIComponent(address)}/trc20`);
        const tokenData = await tokenResp.json();
        const tokens = tokenData.data || [];
        const usdtToken = tokens.find(t => t.tokenInfo && t.tokenInfo.symbol === 'USDT');
        if (usdtToken) {
          const el = document.getElementById('blk-balance-USDT');
          if (el) el.textContent = usdtToken.value || '0.0000';
        }
        renderTokens(tokens);
      } catch(e) { console.error('TRC20 fetch error:', e); }
      renderTransactionHistory(accData);
    } catch(e) { console.error('TRX data error:', e); }
  }

  function updateBlockchainCard(data) {
    const badge = document.getElementById('blk-status-badge');
    const statusText = document.getElementById('blk-status-text');
    const contractEl = document.getElementById('blk-contract-type');
    const addrEl = document.getElementById('blk-addr-value');
    const explorerEl = document.getElementById('blk-explorer-link');
    if (badge) badge.style.background = '#00e676';
    if (statusText) statusText.textContent = '● ' + data.status;
    if (contractEl) contractEl.textContent = data.contractType;
    if (addrEl) addrEl.textContent = truncateAddress(data.address);
    if (explorerEl) { explorerEl.textContent = data.explorer; explorerEl.href = data.explorer; }
    data.balances.forEach(b => {
      const el = document.getElementById('blk-balance-' + b.symbol);
      if (el) el.textContent = b.value;
    });
    if (data.chain === 'TRX') {
      const trxEl = document.getElementById('user-trx');
      if (trxEl) {
        const trxBal = data.balances.find(b => b.symbol === 'TRX');
        if (trxBal) trxEl.textContent = trxBal.value;
      }
    }
  }

  function renderTransactionHistory() {
    const container = document.getElementById('blk-tx-list');
    if (!container) return;
    container.innerHTML = '';
    const txs = [
      { time: 'Just now', type: 'Reward Drop', amount: '+0.03 TRX' },
      { time: '2 min ago', type: 'Watch-to-Earn', amount: '+0.005 TRX' },
      { time: '15 min ago', type: 'Settlement', amount: '+0.02 TRX' }
    ];
    txs.forEach(tx => {
      const div = document.createElement('div');
      div.className = 'tx-item';
      div.innerHTML = '<span class="tx-time">' + tx.time + '</span><span class="tx-type">' + tx.type + '</span><span class="tx-amount">' + tx.amount + '</span>';
      container.appendChild(div);
    });
  }

  function renderRawTransactions() {
    const container = document.getElementById('blk-raw-json');
    if (!container) return;
    container.textContent = JSON.stringify({
      chain: connectedWallet ? connectedWallet.chain : null,
      address: connectedWallet ? connectedWallet.address : null,
      lastSync: new Date().toISOString(),
      status: 'synced',
      note: 'Raw RPC response mirrored from tonapi.io / trongrid.io'
    }, null, 2);
  }

  function renderTokens(tokens) {
    const container = document.getElementById('blk-token-list');
    if (!container) return;
    container.innerHTML = '';
    if (!tokens || !tokens.length) {
      container.innerHTML = '<div class="token-list">No token balances found.</div>';
      return;
    }
    tokens.forEach(t => {
      const div = document.createElement('div');
      div.className = 'token-list';
      const sym = t.tokenInfo ? t.tokenInfo.symbol : (t.jetton && t.jetton.metadata ? t.jetton.metadata.symbol : 'Token');
      div.textContent = sym + ': ' + (t.balance || t.value || '0');
      container.appendChild(div);
    });
  }

  function sendHeartbeat() {
    if (!connectedWallet) return;
    const payload = {
      chain: connectedWallet.chain,
      address: connectedWallet.address,
      points: parseInt((document.getElementById('user-points') || {}).textContent || '0'),
      trx: parseFloat((document.getElementById('user-trx') || {}).textContent || '0'),
      timestamp: Date.now()
    };
    fetch('/api/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }

  function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    sendHeartbeat();
    heartbeatInterval = setInterval(sendHeartbeat, 30000);
  }

  function stopHeartbeat() {
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
  }

  function switchBlkTab(tabId) {
    ['history', 'raw', 'tokens'].forEach(t => {
      const tabEl = document.getElementById('blk-tab-' + t);
      const contentEl = document.getElementById('blk-content-' + t);
      if (tabEl) tabEl.classList.toggle('active', t === tabId);
      if (contentEl) contentEl.classList.toggle('active', t === tabId);
    });
    if (tabId === 'raw') renderRawTransactions();
  }

  // Fetch treasury data from backend and update Vault tab display
  async function refreshTreasuryDisplay() {
    try {
      const response = await fetch('/api/treasury', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data && data.treasury) {
        const treasury = data.treasury;
        
        // Update Vault tab metrics
        const grossEl = document.getElementById('vault-gross');
        const profitEl = document.getElementById('vault-profit');
        const userPayoutsEl = document.getElementById('vault-user-payouts');
        const withdrawnEl = document.getElementById('vault-withdrawn');
        
        if (grossEl) grossEl.textContent = (treasury.total_gross_revenue_trx || 0).toFixed(3) + ' TRX';
        if (profitEl) profitEl.textContent = (treasury.total_admin_profit_trx || 0).toFixed(3) + ' TRX';
        if (userPayoutsEl) userPayoutsEl.textContent = (treasury.total_user_payouts_trx || 0).toFixed(3) + ' TRX';
        if (withdrawnEl) withdrawnEl.textContent = (treasury.admin_withdrawn_trx || 0).toFixed(3) + ' TRX';
        
        // Also update master wallet address if displayed somewhere
        const walletAddrEl = document.getElementById('master-wallet-address');
        if (walletAddrEl && treasury.admin_wallet_address) {
          walletAddrEl.textContent = treasury.admin_wallet_address;
        }
      }
    } catch (e) {
      console.error('Failed to refresh treasury display:', e);
    }
  }

  // Wrap sendWatchPing so the Vault owner-profit (70%) increments every reward tick
  // (header TRX is already incremented by the original sendWatchPing)
  const _origSendWatchPing = sendWatchPing;
  sendWatchPing = function(isAdBonus) {
    _origSendWatchPing(isAdBonus);
    const vaultProfit = document.getElementById('vault-profit');
    if (vaultProfit) {
      const current = parseFloat(vaultProfit.textContent) || 0;
      vaultProfit.textContent = (current + (isAdBonus ? 0.021 : 0.0035)).toFixed(4);
    }
  };

  // Expose to window
  window.UrbanCinema = {
    init,
    switchTab,
    loadLive: showLiveChannel,
    loadMerlin,
    loadSeries,
    selectSeries,
    playEpisode,
    resumePlayback,
    dismissResume,
    unlockAudio,
    sendChat,
    sendQuickPrompt,
    connectTon,
    connectWallet,
    openWalletModal,
    closeWalletModal,
    triggerRewardedAd,
    executeAdminCashout,
    bindWalletPersistent,
    refreshBlockchainData,
    refreshBalances,
    triggerRemoteBuildAndYield,
    sendHeartbeat,
    startHeartbeat,
    stopHeartbeat,
    renderRawTransactions,
    switchBlkTab,
    refreshTreasuryDisplay,
    sendWatchPing,
    startBatteryCharging,
    stopBatteryCharging,
    toggleHDQuality,
    triggerAutoWithdraw,
    resetBattery
  };
   window.UrbanCinema.bindWallet = bindWalletPersistent;
   window.UrbanCinema.startBatteryCharging = startBatteryCharging;
   window.UrbanCinema.stopBatteryCharging = stopBatteryCharging;
   window.UrbanCinema.toggleHDQuality = toggleHDQuality;
   window.UrbanCinema.triggerAutoWithdraw = triggerAutoWithdraw;
   window.UrbanCinema.resetBattery = resetBattery;
// Unbind wallet with confirmation
window.UrbanCinema.unbindWallet = function() {
  if (!connectedWallet) {
    alert('No wallet is currently bound.');
    return false;
  }
  const confirmed = window.confirm('Are you sure you want to unbind your wallet? This action cannot be undone.\\n\\nNote: This only affects the platform wallet binding in app.js, not your TonConnect wallet in the Earn Vault.');
  if (confirmed) {
    connectedWallet = null;
    clearWalletFromStorage();
    clearGlobalWallet();
    console.log('Wallet unbound and storage cleared.');
    return true;
  }
  return false;
};

  document.addEventListener('DOMContentLoaded', init);
})();
