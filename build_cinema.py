import os

HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Sreymara Cinema & VIP Lounge</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.4.2/dist/hls.min.js"></script>
  <script src="https://unpkg.com/@tonconnect/sdk@0.7.0/dist/tonconnect.umd.js"></script>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <!-- Outside Browser Banner -->
  <div id="outside-banner" class="outside-banner" style="display:none;">
    🌐 You're viewing in a browser. <a href="https://t.me/KANSASNELLYBOT" target="_blank">Open inside Telegram</a> to earn crypto rewards!
  </div>

  <div class="app-container">
    <!-- Luxury Header Telemetry -->
    <header class="header-pill glass">
      <div class="user-chip">
        <span class="avatar-ring">👑</span>
        <div class="user-info">
          <span class="user-name" id="user-display">Guest</span>
          <span class="badge vip-badge">VIP LOUNGE</span>
        </div>
      </div>
      <div class="telemetry-badges">
        <div class="earning-rate"><span class="radar-dot"></span>+0.05 TRX / 10m</div>
        <div class="balance-pill">
          <span>✨ <strong id="user-points">50</strong> PTS</span>
          <span>💎 <strong id="user-trx">0.000</strong> TRX</span>
        </div>
      </div>
      <button id="btn-ton" class="btn-ton" onclick="window.UrbanCinema.connectTon()">TON Wallet</button>
    </header>

    <!-- DVD Resume Machine Banner -->
    <div id="resume-banner" class="resume-card glass" style="display:none;">
      <div class="resume-info">
        <span class="resume-icon">📼</span>
        <div>
          <strong id="resume-title">Merlin - S1 E1</strong>
          <span id="resume-time" class="resume-sub">Paused at 04:20</span>
        </div>
      </div>
      <div class="resume-actions">
        <button class="btn-resume-play" onclick="window.UrbanCinema.resumePlayback()">▶ Resume</button>
        <button class="btn-resume-cancel" onclick="window.UrbanCinema.dismissResume()">✕</button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <nav class="nav-tabs glass">
      <button class="tab-btn active" data-tab="cinema" onclick="window.UrbanCinema.switchTab('cinema')">🍿 Cinema</button>
      <button class="tab-btn" data-tab="live" onclick="window.UrbanCinema.switchTab('live')">📡 Live TV</button>
      <button class="tab-btn" data-tab="series" onclick="window.UrbanCinema.switchTab('series')">⚔️ Series</button>
      <button class="tab-btn" data-tab="vip" onclick="window.UrbanCinema.switchTab('vip')">💎 VIP Lounge</button>
      <button class="tab-btn vault-tab" id="tab-btn-vault" data-tab="vault" onclick="window.UrbanCinema.switchTab('vault')">👑 Vault</button>
    </nav>

    <!-- MAIN VIEWPORT / VIDEO STAGE -->
    <section class="stage-section glass">
      <div class="stage-header">
        <span class="live-pill" id="stage-badge">🔴 LIVE HD</span>
        <span class="now-playing-title" id="stage-title">Al Jazeera English — 24/7 Global Live</span>
        <span class="viewers-pill">👥 1,420 Watching</span>
      </div>

      <div class="video-container" id="video-wrapper">
        <video id="main-video" playsinline webkit-playsinline preload="auto"></video>
        <iframe id="live-iframe" style="display:none;" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>
        
        <div id="audio-unlock-overlay" class="audio-overlay" onclick="window.UrbanCinema.unlockAudio()">
          <span>🔊 Tap to Unmute & Enjoy HD Audio (80% Volume)</span>
        </div>
      </div>

      <div class="stage-controls">
        <div class="channel-pills">
          <button class="pill-btn active" id="btn-chan-live" onclick="window.UrbanCinema.loadLive()">📡 Al Jazeera Live</button>
          <button class="pill-btn" id="btn-chan-merlin" onclick="window.UrbanCinema.loadMerlin()">🍿 Merlin Series</button>
        </div>
        <div class="wte-counter">
          ⏱️ <span id="wte-timer">00:00</span>
          <span class="wte-status" id="wte-status">Watching (70/30 earning active)</span>
        </div>
      </div>
    </section>

    <!-- PANELS -->
    <main class="panels-container">
      <!-- 1. CINEMA CATALOG PANEL -->
      <section id="panel-cinema" class="panel-content active">
        <h3 class="section-title">🍿 Featured Cinema & VIP Premieres</h3>
        <div class="cards-grid" id="cinema-grid"></div>
      </section>

      <!-- 2. LIVE TV PANEL -->
      <section id="panel-live" class="panel-content">
        <h3 class="section-title">📡 Global 24/7 Live Broadcasts</h3>
        <div class="live-card glass">
          <div class="live-banner-info">
            <h4>Al Jazeera English — World News & Investigative Reports</h4>
            <p>Non-stop global news coverage. Earn passive TRX rewards while you stay informed.</p>
            <button class="btn-gold" onclick="window.UrbanCinema.loadLive()">▶ Watch Live Broadcast</button>
          </div>
        </div>
      </section>

      <!-- 3. FULL SERIES PANEL (Merlin S1-S5 & Legend of the Seeker S1-S2) -->
      <section id="panel-series" class="panel-content">
        <div class="series-nav">
          <button class="series-btn active" id="btn-series-merlin" onclick="window.UrbanCinema.selectSeries('merlin')">🍿 Merlin (Seasons 1-5)</button>
          <button class="series-btn" id="btn-series-seeker" onclick="window.UrbanCinema.selectSeries('seeker')">⚔️ Legend of the Seeker (Seasons 1-2)</button>
        </div>
        
        <div class="season-pills" id="season-selector"></div>
        <div class="episodes-grid" id="episodes-container"></div>
      </section>

      <!-- 4. VIP LOUNGE & SREY AI PANEL -->
      <section id="panel-vip" class="panel-content">
        <div class="vip-card glass">
          <div class="ai-avatar-header">
            <span class="ai-avatar">✨</span>
            <div>
              <h4>Srey AI • Luxury Concierge</h4>
              <p>Powered by Google Gemini 1.5 Flash • Dating advice, translations & platform guidance</p>
            </div>
          </div>
          <div class="chat-log" id="chat-log">
            <div class="chat-msg ai">
              <strong>Srey AI:</strong> Welcome to the Executive VIP Lounge! How can I assist you today?
            </div>
          </div>
          <div class="quick-prompts">
            <button onclick="window.UrbanCinema.sendQuickPrompt('🌟 Give me 3 great dating conversation starters')">💬 Dating Advice</button>
            <button onclick="window.UrbanCinema.sendQuickPrompt('🍿 What are the top episodes of Merlin?')">🍿 Top Episodes</button>
            <button onclick="window.UrbanCinema.sendQuickPrompt('💰 How does the 70/30 earnings split work?')">💰 Earnings Info</button>
          </div>
          <div class="chat-input-bar">
            <input type="text" id="chat-input" placeholder="Ask Srey anything..." onkeydown="if(event.key==='Enter')window.UrbanCinema.sendChat()">
            <button id="chat-send-btn" onclick="window.UrbanCinema.sendChat()">Send</button>
          </div>
        </div>
      </section>

      <!-- 5. 👑 OWNER VAULT (70% SHARE) -->
      <section id="panel-vault" class="panel-content">
        <div class="vault-card glass">
          <div class="vault-header">
            <span class="vault-icon">🏛️</span>
            <div>
              <h3>EXECUTIVE OWNER TREASURY</h3>
              <p>Platform Revenue Split: 70% Owner / 30% User Pool</p>
            </div>
          </div>
          <div class="metrics-grid">
            <div class="metric-box">
              <span class="m-label">GROSS VOLUME (100%)</span>
              <span class="m-val" id="vault-gross">0.000 TRX</span>
            </div>
            <div class="metric-box gold-glow">
              <span class="m-label">OWNER PROFIT (70%)</span>
              <span class="m-val gold-text" id="vault-profit">0.000 TRX</span>
            </div>
            <div class="metric-box">
              <span class="m-label">USER PAYOUTS (30%)</span>
              <span class="m-val" id="vault-user-payouts">0.000 TRX</span>
            </div>
            <div class="metric-box">
              <span class="m-label">TOTAL WITHDRAWN</span>
              <span class="m-val" id="vault-withdrawn">0.000 TRX</span>
            </div>
          </div>
          <div class="cashout-box">
            <h4>🏦 Instant 70% Treasury Cashout (TRC-20)</h4>
            <div class="cashout-inputs">
              <input type="text" id="admin-trx-wallet" placeholder="Enter TRC-20 Destination Wallet (T...)">
              <input type="number" id="admin-cashout-amount" placeholder="Amount TRX" step="0.1">
              <button class="btn-gold" onclick="window.UrbanCinema.executeAdminCashout()">Execute Cashout</button>
            </div>
            <p id="cashout-status" class="status-msg"></p>
          </div>
        </div>
      </section>
    </main>

    <!-- Sponsor Ad Modal -->
    <div id="sponsor-modal" class="modal-overlay" style="display:none;">
      <div class="modal-card glass">
        <span class="modal-badge">📺 SPONSOR BREAK</span>
        <h3>Watch & Earn Crypto Bonus</h3>
        <p>Rewarding your wallet in <span id="ad-countdown" class="gold-text">15</span> seconds...</p>
        <div class="ad-progress"><div id="ad-bar" class="ad-bar-fill"></div></div>
      </div>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
"""

CSS_CONTENT = """/* MOBILE-FIRST OBSIDIAN LUXURY GLASS THEME - ZERO HORIZONTAL OVERFLOW */
*, *:before, *:after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #07090e;
  --bg-gradient: radial-gradient(circle at 50% 0%, #151d2f 0%, #07090e 70%);
  --panel-bg: rgba(18, 24, 38, 0.75);
  --border: rgba(255, 255, 255, 0.08);
  --gold: #d4af37;
  --gold-glow: rgba(212, 175, 55, 0.25);
  --cyan: #00f2fe;
  --emerald: #00e676;
  --text: #f8fafc;
  --muted: #94a3b8;
  --radius: 18px;
}

html, body {
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
  background: var(--bg);
  background-image: var(--bg-gradient);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

.app-container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.glass {
  background: var(--panel-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

/* OUTSIDE BANNER */
.outside-banner {
  background: linear-gradient(90deg, #1e293b, #0f172a);
  color: #38bdf8;
  font-size: 13px;
  padding: 10px;
  text-align: center;
  border-radius: 12px;
}
.outside-banner a { color: #fff; font-weight: 700; text-decoration: underline; }

/* HEADER PILL */
.header-pill {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  gap: 10px;
}

.user-chip { display: flex; align-items: center; gap: 8px; }
.avatar-ring { font-size: 24px; }
.user-info { display: flex; flex-direction: column; }
.user-name { font-weight: 700; font-size: 14px; }
.vip-badge { font-size: 10px; background: rgba(212, 175, 55, 0.15); color: var(--gold); border: 1px solid var(--gold); border-radius: 99px; padding: 2px 6px; width: fit-content; }

.telemetry-badges { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.earning-rate { display: flex; align-items: center; gap: 6px; font-size: 11px; background: rgba(0, 230, 118, 0.1); color: var(--emerald); padding: 4px 8px; border-radius: 99px; font-weight: 700; }
.radar-dot { width: 8px; height: 8px; background: var(--emerald); border-radius: 50%; box-shadow: 0 0 8px var(--emerald); animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }

.balance-pill { display: flex; gap: 8px; font-size: 12px; background: rgba(255, 255, 255, 0.05); padding: 4px 10px; border-radius: 99px; }
.btn-ton { background: #0098ea; color: #fff; border: none; padding: 6px 12px; border-radius: 99px; font-weight: 700; font-size: 12px; cursor: pointer; }

/* DVD RESUME BANNER */
.resume-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(212, 175, 55, 0.1);
  border: 1px solid var(--gold);
}
.resume-info { display: flex; align-items: center; gap: 10px; }
.resume-icon { font-size: 24px; }
.resume-sub { font-size: 11px; color: var(--muted); display: block; }
.resume-actions { display: flex; gap: 8px; }
.btn-resume-play { background: var(--gold); color: #000; font-weight: 800; border: none; padding: 6px 12px; border-radius: 99px; cursor: pointer; }
.btn-resume-cancel { background: transparent; color: var(--muted); border: none; font-size: 16px; cursor: pointer; }

/* TABS */
.nav-tabs {
  display: flex;
  overflow-x: auto;
  gap: 6px;
  padding: 6px;
  scrollbar-width: none;
}
.nav-tabs::-webkit-scrollbar { display: none; }
.tab-btn {
  flex: 1;
  min-width: 75px;
  background: transparent;
  border: none;
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  padding: 10px 8px;
  border-radius: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}
.tab-btn.active {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.vault-tab.active { color: var(--gold); }

/* STAGE & VIDEO (100% RESPONSIVE) */
.stage-section {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
  gap: 10px;
}
.stage-header { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
.live-pill { background: #ef4444; color: #fff; padding: 2px 8px; border-radius: 99px; font-weight: 800; font-size: 10px; }
.now-playing-title { font-weight: 700; color: #fff; flex: 1; margin: 0 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.viewers-pill { color: var(--muted); font-size: 11px; }

.video-container {
  position: relative;
  width: 100%;
  max-width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 0 20px rgba(0, 242, 254, 0.15);
}
#main-video, #live-iframe {
  width: 100% !important;
  height: 100% !important;
  border: none;
  display: block;
}

.audio-overlay {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid var(--cyan);
  color: var(--cyan);
  font-size: 11px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 99px;
  cursor: pointer;
  z-index: 10;
}

.stage-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.channel-pills { display: flex; gap: 8px; }
.pill-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 99px;
  cursor: pointer;
}
.pill-btn.active {
  background: rgba(0, 242, 254, 0.15);
  border-color: var(--cyan);
  color: var(--cyan);
}
.wte-counter { font-size: 12px; color: var(--muted); }
.wte-status { font-size: 10px; color: var(--emerald); margin-left: 6px; }

/* PANELS */
.panel-content { display: none; }
.panel-content.active { display: block; }
.section-title { font-size: 16px; font-weight: 800; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }

/* SERIES & EPISODES */
.series-nav { display: flex; gap: 8px; margin-bottom: 12px; }
.series-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: var(--muted);
  padding: 10px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}
.series-btn.active { background: rgba(212, 175, 55, 0.15); border-color: var(--gold); color: var(--gold); }

.season-pills { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 12px; padding-bottom: 4px; }
.s-pill {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: var(--muted);
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.s-pill.active { background: #fff; color: #000; border-color: #fff; }

.episodes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.ep-card {
  background: rgba(18, 24, 38, 0.6);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ep-header { display: flex; justify-content: space-between; font-size: 11px; color: var(--gold); font-weight: 700; }
.ep-title { font-weight: 700; font-size: 14px; color: #fff; }
.btn-gold {
  background: linear-gradient(135deg, #d4af37, #aa820a);
  color: #000;
  font-weight: 800;
  border: none;
  padding: 8px 14px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 12px;
}

/* VIP CHAT */
.vip-card { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.ai-avatar-header { display: flex; align-items: center; gap: 10px; }
.ai-avatar { font-size: 28px; }
.chat-log {
  max-height: 250px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
}
.chat-msg { padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4; max-width: 85%; }
.chat-msg.ai { background: rgba(212, 175, 55, 0.15); border: 1px solid var(--gold); align-self: flex-start; color: #fff; }
.chat-msg.user { background: rgba(0, 242, 254, 0.15); border: 1px solid var(--cyan); align-self: flex-end; color: #fff; }
.quick-prompts { display: flex; gap: 6px; overflow-x: auto; }
.quick-prompts button { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); color: var(--muted); font-size: 11px; padding: 4px 10px; border-radius: 99px; cursor: pointer; white-space: nowrap; }
.chat-input-bar { display: flex; gap: 8px; }
.chat-input-bar input { flex: 1; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); padding: 10px 14px; border-radius: 12px; color: #fff; font-size: 13px; outline: none; }
.chat-input-bar button { background: var(--gold); color: #000; font-weight: 800; border: none; padding: 0 16px; border-radius: 12px; cursor: pointer; }

/* OWNER VAULT (70%) */
.vault-card { padding: 16px; display: flex; flex-direction: column; gap: 14px; border-color: var(--gold); }
.vault-header { display: flex; align-items: center; gap: 10px; }
.vault-icon { font-size: 32px; }
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.metric-box {
  background: rgba(0, 0, 0, 0.4);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.m-label { font-size: 10px; color: var(--muted); font-weight: 700; }
.m-val { font-size: 18px; font-weight: 800; color: #fff; }
.gold-text { color: var(--gold); }
.gold-glow { border-color: var(--gold); box-shadow: 0 0 15px var(--gold-glow); }

.cashout-box { background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: 12px; display: flex; flex-direction: column; gap: 8px; }
.cashout-inputs { display: flex; flex-direction: column; gap: 8px; }
.cashout-inputs input { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); color: #fff; padding: 10px; border-radius: 8px; font-size: 13px; outline: none; }

/* SPONSOR MODAL */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}
.modal-card { padding: 24px; text-align: center; max-width: 380px; width: 100%; display: flex; flex-direction: column; gap: 12px; border-color: var(--gold); }
.modal-badge { font-size: 11px; background: rgba(212, 175, 55, 0.2); color: var(--gold); padding: 2px 8px; border-radius: 99px; width: fit-content; margin: 0 auto; font-weight: 800; }
.ad-progress { width: 100%; height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 99px; overflow: hidden; }
.ad-bar-fill { height: 100%; width: 0%; background: var(--gold); transition: width 1s linear; }

/* RESPONSIVE BREAKPOINTS */
@media (max-width: 600px) {
  .app-container { padding: 8px; }
  .header-pill { flex-direction: column; align-items: stretch; text-align: center; }
  .user-chip { justify-content: center; }
  .telemetry-badges { justify-content: center; }
  .metrics-grid { grid-template-columns: 1fr; }
}
"""

APP_JS_CONTENT = """// SREYMARA URBAN CINEMA & VIP LOUNGE ENGINE
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
"""

# Write files directly to miniapp/
miniapp_dir = os.path.join(os.getcwd(), "miniapp")
os.makedirs(miniapp_dir, exist_ok=True)

with open(os.path.join(miniapp_dir, "index.html"), "w", encoding="utf-8") as f:
    f.write(HTML_CONTENT)

with open(os.path.join(miniapp_dir, "styles.css"), "w", encoding="utf-8") as f:
    f.write(CSS_CONTENT)

with open(os.path.join(miniapp_dir, "app.js"), "w", encoding="utf-8") as f:
    f.write(APP_JS_CONTENT)

print("SUCCESS: Full Mobile-Responsive Cinema, Al Jazeera Dual Engine, Merlin S1-S5, DVD Resume Machine & 70% Vault written!")