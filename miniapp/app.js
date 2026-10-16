// SREYMARA URBAN CINEMA & VIP LOUNGE ENGINE
(function() {
  const OWNER_ID = "8522820906";
  const LIVE_HLS_URL = "https://live-hls-web-aje.getaj.net/AJE/01.m3u8";
  const LIVE_FALLBACK_EMBED = "https://www.youtube-nocookie.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg&autoplay=1&mute=0";
  const SAMPLE_MERLIN_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

  // Catalog: Merlin S1-S5 and Legend of the Seeker S1-S2
  const SERIES_CATALOG = {
    merlin: {
      title: "Merlin: The Legend Begins",
      seasons: {
        1: [
          { ep: 1, title: "The Dragon's Call", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 2, title: "Valiant", duration: "43m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 3, title: "The Mark of Nimueh", duration: "44m", url: SAMPLE_MERLIN_VIDEO }
        ],
        2: [
          { ep: 1, title: "The Curse of Cornelius Sigan", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 2, title: "The Once and Future Queen", duration: "44m", url: SAMPLE_MERLIN_VIDEO }
        ],
        3: [{ ep: 1, title: "The Tears of Uther Pendragon", duration: "45m", url: SAMPLE_MERLIN_VIDEO }],
        4: [{ ep: 1, title: "The Darkest Hour", duration: "45m", url: SAMPLE_MERLIN_VIDEO }],
        5: [{ ep: 1, title: "Arthur's Bane", duration: "45m", url: SAMPLE_MERLIN_VIDEO }]
      }
    },
    seeker: {
      title: "Legend of the Seeker",
      seasons: {
        1: [
          { ep: 1, title: "Prophecy", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 2, title: "Destiny", duration: "44m", url: SAMPLE_MERLIN_VIDEO }
        ],
        2: [
          { ep: 1, title: "Nightfall", duration: "45m", url: SAMPLE_MERLIN_VIDEO },
          { ep: 2, title: "Baneling", duration: "43m", url: SAMPLE_MERLIN_VIDEO }
        ]
      }
    }
  };

  let hlsInstance = null;
  let activeSeries = "merlin";
  let activeSeason = 1;
  let currentPlaying = null;
  let isEarning = false;
  let earningSeconds = 0;
  let earningTimer = null;
  let tgUser = null;

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
  }

  // --- DUAL-ENGINE LIVE STREAM ---
  function loadLive() {
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
  function playEpisode(seriesKey, seasonNum, epNum, startTime = 0) {
    const series = SERIES_CATALOG[seriesKey];
    if (!series || !series.seasons[seasonNum]) return;
    const ep = series.seasons[seasonNum].find(e => e.ep === epNum);
    if (!ep) return;

    const video = document.getElementById('main-video');
    const iframe = document.getElementById('live-iframe');
    const badge = document.getElementById('stage-badge');
    const title = document.getElementById('stage-title');

    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
    iframe.style.display = 'none';
    video.style.display = 'block';

    title.textContent = `${series.title} - S${seasonNum} E${epNum}: ${ep.title}`;
    badge.textContent = "🍿 CINEMA";
    badge.style.background = "#d4af37";

    document.getElementById('btn-chan-live').classList.remove('active');
    document.getElementById('btn-chan-merlin').classList.add('active');

    currentPlaying = { type: 'series', series: seriesKey, season: seasonNum, ep: epNum, title: ep.title };
    video.src = ep.url;
    video.currentTime = startTime;
    video.play().catch(() => {});

    // Save resume timestamp every 5 seconds
    video.ontimeupdate = () => {
      if (video.currentTime > 5 && !video.paused) {
        localStorage.setItem('sreymara_playback_resume', JSON.stringify({
          series: seriesKey,
          seriesName: series.title,
          season: seasonNum,
          ep: epNum,
          epTitle: ep.title,
          time: Math.floor(video.currentTime)
        }));
      }
    };

    // When episode ends, trigger sponsor ad
    video.onended = () => {
      triggerSponsorAd();
    };
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

  function unlockAudio() {
    const video = document.getElementById('main-video');
    video.muted = false;
    video.volume = 0.8;
    document.getElementById('audio-unlock-overlay').style.display = 'none';
  }

  // --- TABS & CHAT ---
  function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tabId));
    document.querySelectorAll('.panel-content').forEach(p => p.classList.toggle('active', p.id === `panel-${tabId}`));
    window.location.hash = `tab=${tabId}`;
  }

  function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    const log = document.getElementById('chat-log');
    log.innerHTML += `<div class="chat-msg user"><strong>You:</strong> ${msg}</div>`;
    log.scrollTop = log.scrollHeight;

    setTimeout(() => {
      log.innerHTML += `<div class="chat-msg ai"><strong>Srey AI:</strong> You're in the VIP Lounge! Enjoying the Merlin cinema series? Let me know if you need dating advice or crypto withdrawal support.</div>`;
      log.scrollTop = log.scrollHeight;
    }, 800);
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

  // Expose to window
  window.UrbanCinema = {
    init,
    switchTab,
    loadLive,
    loadMerlin,
    selectSeries,
    playEpisode,
    resumePlayback,
    dismissResume,
    unlockAudio,
    sendChat,
    sendQuickPrompt,
    connectTon,
    executeAdminCashout
  };

  document.addEventListener('DOMContentLoaded', init);
})();
