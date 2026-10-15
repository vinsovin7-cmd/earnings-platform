/* miniapp app.js
 * Sreymara Paradise - Universal Master Web App.
 * - 4 tabs: Merlin Cinema / Al Jazeera Live / VIP+Srey AI / Owner Vault (70%).
 * - Watch-to-earn pings are SERVER-VERIFIED: the client posts the signed Telegram
 *   initData to /api/watch-ping; balances shown are ONLY what the server returns
 *   (split 70/30). No browser-local balance is trusted (see miniapp/README.md).
 * - Preserves the original TonConnect + Phantom wallet UI and sample catalog.
 */
(function(){
'use strict';
var tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
if (tg) { tg.ready(); tg.expand(); }
var TG_USER = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : null;
var TG_INIT_DATA = tg ? tg.initData : '';
var IN_TELEGRAM = !!(tg && tg.initData && TG_USER);
var OWNER_ID = 8522820906;
var API_BASE = window.API_BASE || window.WATCH_API_BASE || '';
var PING_INTERVAL_MS = 60 * 1000;
var channels = {
  aljazeera: { title: 'Al Jazeera English - Live', live: true, src: 'https://live-hls-web-aje.getaj.net/AJE/01.m3u8' },
  merlin: { title: 'Merlin Series VIP', live: false, playlist: [
    { title: 'Big Buck Bunny (Sample)', src: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
    { title: 'Sintel (Sample)', src: 'https://media.w3.org/2010/05/sintel/trailer_hd.m3u8' }
  ] }
};
var catalog = [
  { id: 'bigbuckbunny', title: 'Big Buck Bunny (Sample)', icon: '\u{1F430}', priceUSD: 1.99, src: channels.merlin.playlist[0].src },
  { id: 'sintel', title: 'Sintel (Sample)', icon: '\u{1F409}', priceUSD: 2.99, src: channels.merlin.playlist[1].src }
];
var usd = new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'});
function el(id){ return document.getElementById(id); }

function switchTab(name){
  var panels = document.querySelectorAll('.panel');
  for (var i=0;i<panels.length;i++) panels[i].classList.remove('active');
  var panel = el('panel-' + name);
  if (panel) panel.classList.add('active');
  var tabs = document.querySelectorAll('#tabs .tab, #tabs-bottom .tab');
  for (var j=0;j<tabs.length;j++) tabs[j].classList.toggle('active', tabs[j].dataset.tab === name);
  if (name === 'vault') loadVault();
}
function setupTabs(){
  var btns = document.querySelectorAll('#tabs .tab, #tabs-bottom .tab');
  for (var i=0;i<btns.length;i++) btns[i].addEventListener('click', function(){ switchTab(this.dataset.tab); });
}
function renderTelemetry(){
  var userEl = el('tg-user');
  if (userEl){
    if (TG_USER){
      var handle = TG_USER.username ? '@'+TG_USER.username : (TG_USER.first_name || 'User');
      userEl.textContent = '\u{1F464} ' + handle + ' (' + TG_USER.id + ')';
    } else { userEl.textContent = '\u{1F464} Guest (open inside Telegram)'; }
  }
  var vip = el('vip-badge');
  if (vip && TG_USER && TG_USER.id === OWNER_ID) vip.classList.remove('hidden');
  var isOwner = TG_USER && TG_USER.id === OWNER_ID;
  var vtabs = document.querySelectorAll('.vault-tab');
  for (var i=0;i<vtabs.length;i++) vtabs[i].style.display = isOwner ? '' : 'none';
}
function updateBadges(points, trx){
  var p = el('points-badge'), t = el('trx-badge');
  if (p) p.textContent = '\u2728 ' + (points || 0);
  if (t) t.textContent = '\u{1F4B5} ' + Number(trx || 0).toFixed(4);
}
function setEarnStatus(msg, isError){
  var e = el('earn-status');
  if (e){ e.textContent = msg || ''; e.style.color = isError ? '#f43f5e' : '#10b981'; }
}
function setupFallback(){
  if (!IN_TELEGRAM){
    var b = el('outside-banner'); if (b) b.style.display = 'block';
    var f = el('tg-fab'); if (f) f.style.display = 'inline-flex';
  }
}

function attachHls(video, src, onManifest){
  if (window.Hls && window.Hls.isSupported()){
    if (video._hls){ try{ video._hls.destroy(); }catch(e){} video._hls = null; }
    var hls = new window.Hls();
    video._hls = hls;
    hls.loadSource(src); hls.attachMedia(video);
    hls.on(window.Hls.Events.MANIFEST_PARSED, function(){ video.play().catch(function(){}); if(onManifest) onManifest(); });
    hls.on(window.Hls.Events.ERROR, function(evt, data){ if (data && data.fatal){ try{ hls.destroy(); }catch(e){} } });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')){
    video.src = src;
    video.addEventListener('loadedmetadata', function(){ video.play().catch(function(){}); if(onManifest) onManifest(); });
  } else { alert('HLS is not supported in this browser.'); }
}
var currentPlaylistIndex = 0;
function loadMerlin(index){
  currentPlaylistIndex = index || 0;
  var item = channels.merlin.playlist[currentPlaylistIndex];
  var video = el('video-player'); var hint = el('player-hint');
  if (hint) hint.textContent = 'Now playing: ' + item.title;
  attachHls(video, item.src);
  video.onended = function(){
    currentPlaylistIndex = (currentPlaylistIndex + 1) % channels.merlin.playlist.length;
    loadMerlin(currentPlaylistIndex);
  };
}
function loadLive(){
  var video = el('video-player-live');
  attachHls(video, channels.aljazeera.src);
  var hint = el('live-hint');
  if (hint) hint.textContent = 'Connecting to Al Jazeera English live stream...';
}
function renderCatalog(){
  var grid = el('catalog-grid'); if (!grid) return;
  grid.innerHTML = '';
  catalog.forEach(function(item){
    var card = document.createElement('div');
    card.className = 'card-item glass';
    card.innerHTML = '<div class="thumb">' + item.icon + '</div>' +
      '<div class="meta"><h4>' + item.title + '</h4>' +
      '<div class="price">' + usd.format(item.priceUSD) + '</div>' +
      '<button class="btn cyan" data-src="' + item.src + '" style="margin-top:8px;width:100%">Play</button></div>';
    grid.appendChild(card);
  });
  grid.addEventListener('click', function(ev){
    var btn = ev.target.closest('button[data-src]'); if (!btn) return;
    attachHls(el('video-player'), btn.dataset.src);
    var hint = el('player-hint'); if (hint) hint.textContent = 'Now playing a sample title.';
  });
}
var earning = false, pingTimer = null, countdownTimer = null, secondsElapsed = 0, secondsToNextPing = 60;
function fmt(sec){ var m=String(Math.floor(sec/60)).padStart(2,'0'), s=String(sec%60).padStart(2,'0'); return m+':'+s; }
function updateTimers(){
  var t = el('wte-timer'), n = el('wte-next');
  if (t) t.textContent = 'Timer ' + fmt(secondsElapsed);
  if (n) n.textContent = earning ? ('Next ping in ' + secondsToNextPing + 's') : 'Paused';
}
function sendWatchPing(){
  if (!IN_TELEGRAM){ setEarnStatus('Open inside Telegram to earn', true); return; }
  setEarnStatus('Syncing...');
  fetch(API_BASE + '/api/watch-ping', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ initData: TG_INIT_DATA, minutes: 1 })
  }).then(function(r){ return r.json(); }).then(function(data){
    if (data && data.status === 'ok'){
      updateBadges(data.points, data.available_trx);
      var c = data.credited || {};
      setEarnStatus('+' + (c.points||0) + ' pts / +' + Number(c.user_trx||0).toFixed(4) + ' TRX');
    } else { setEarnStatus('Not credited (' + ((data&&data.error)||'err') + ')', true); }
  }).catch(function(){ setEarnStatus('Offline - will retry', true); });
}
function startEarning(){
  earning = true; secondsElapsed = 0; secondsToNextPing = 60;
  var btn = el('wte-toggle'); if (btn) btn.textContent = 'Stop Earning';
  countdownTimer = setInterval(function(){ secondsElapsed++; secondsToNextPing--; if(secondsToNextPing<=0) secondsToNextPing=60; updateTimers(); }, 1000);
  sendWatchPing();
  pingTimer = setInterval(sendWatchPing, PING_INTERVAL_MS);
  updateTimers();
}
function stopEarning(){
  earning = false;
  if (pingTimer) clearInterval(pingTimer); pingTimer = null;
  if (countdownTimer) clearInterval(countdownTimer); countdownTimer = null;
  var btn = el('wte-toggle'); if (btn) btn.textContent = 'Start Earning';
  setEarnStatus(''); updateTimers();
}

function addMsg(text, who){
  var log = el('chat-log'); if (!log) return;
  var div = document.createElement('div');
  div.className = 'msg ' + (who === 'me' ? 'me' : 'ai');
  div.textContent = text; log.appendChild(div); log.scrollTop = log.scrollHeight;
}
function askSrey(){
  var input = el('chat-text'); if (!input) return;
  var text = input.value.trim(); if (!text) return;
  addMsg(text, 'me'); input.value = ''; addMsg('...', 'ai');
  fetch(API_BASE + '/api/srey', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ initData: TG_INIT_DATA, prompt: text })
  }).then(function(r){ return r.json(); }).then(function(data){
    var log = el('chat-log');
    if (log && log.lastChild && log.lastChild.textContent === '...') log.removeChild(log.lastChild);
    addMsg((data && data.reply) ? data.reply : 'Srey is resting right now - try again soon.', 'ai');
  }).catch(function(){
    var log = el('chat-log');
    if (log && log.lastChild && log.lastChild.textContent === '...') log.removeChild(log.lastChild);
    addMsg('Could not reach Srey. Please try again.', 'ai');
  });
}
function loadVault(){
  var isOwner = TG_USER && TG_USER.id === OWNER_ID;
  var lk=el('vault-locked'), vc=el('vault-content');
  if (!isOwner){ if(lk) lk.classList.remove('hidden'); if(vc) vc.classList.add('hidden'); return; }
  if(lk) lk.classList.add('hidden'); if(vc) vc.classList.remove('hidden');
  fetch(API_BASE + '/api/treasury').then(function(r){ return r.json(); }).then(function(data){
    var t = data.treasury || {};
    if (el('tGross')) el('tGross').textContent = (t.total_gross_revenue_trx||0).toFixed(4);
    if (el('tProfit')) el('tProfit').textContent = (t.total_admin_profit_trx||0).toFixed(4);
    if (el('tAvailable')) el('tAvailable').textContent = (t.available_admin_trx||0).toFixed(4);
    if (el('tUserPayouts')) el('tUserPayouts').textContent = (t.total_user_payouts_trx||0).toFixed(4);
    if (el('tWithdrawn')) el('tWithdrawn').textContent = (t.admin_withdrawn_trx||0).toFixed(4);
    var cw=el('cashoutWallet'); if (cw && !cw.value && t.admin_wallet_address) cw.value = t.admin_wallet_address;
    var box=el('adminWithdrawals');
    if (box){ var ws=data.withdrawals||[]; box.innerHTML = ws.length ? ('<b>Recent cashouts:</b><br>'+ws.map(function(w){return '- '+w.amount_trx.toFixed(4)+' TRX to '+w.destination_wallet+' ('+w.timestamp+')';}).join('<br>')) : 'No admin cashouts yet.'; }
  }).catch(function(){});
}
function adminCashout(){
  var amount = parseFloat(el('cashoutAmount').value);
  var wallet = el('cashoutWallet').value.trim();
  if (!amount || amount <= 0){ alert('Enter a valid TRX amount.'); return; }
  if (!confirm('Withdraw ' + amount + ' TRX from the 70% treasury?')) return;
  fetch(API_BASE + '/api/admin-cashout', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ amount_trx: amount, destination_wallet: wallet })
  }).then(function(r){ return r.json(); }).then(function(out){
    if (out.status === 'ok'){ alert('Cashout recorded: '+out.amount_trx+' TRX to '+out.wallet); el('cashoutAmount').value=''; loadVault(); }
    else { alert('Cashout error: '+(out.error||'unknown')+(out.available_admin_trx!==undefined?('\nAvailable: '+out.available_admin_trx+' TRX'):'')); }
  }).catch(function(){ alert('Network error during cashout.'); });
}

var tonConnect, tonAccount = null;
function connectTon(){
  try{
    tonConnect = new window.TonConnect();
    tonConnect.requestWallet().then(function(res){
      el('wallet-info').textContent = JSON.stringify({wallet: res}, null, 2);
      el('wallet-drawer').classList.remove('hidden'); tonAccount = res;
    }).catch(function(){ alert('TonConnect connect failed'); });
  }catch(err){ alert('TonConnect connect failed'); }
}
function connectPhantom(){
  try{
    var provider = window.solana;
    if (!provider || !provider.isPhantom){ alert('Phantom not found.'); return; }
    provider.connect().then(function(resp){
      el('wallet-info').textContent = JSON.stringify({phantom: resp.publicKey.toString()}, null, 2);
      el('wallet-drawer').classList.remove('hidden');
    }).catch(function(){ alert('Phantom connect failed'); });
  }catch(err){ alert('Phantom connect failed'); }
}
function wireUi(){
  var quick=el('cinema-quickplay'); if(quick) quick.addEventListener('click', function(){ loadMerlin(0); });
  var launch=el('cinema-launch'); if(launch) launch.addEventListener('click', function(){ loadMerlin(0); });
  var live=el('live-play'); if(live) live.addEventListener('click', loadLive);
  var toggle=el('wte-toggle'); if(toggle) toggle.addEventListener('click', function(){ earning?stopEarning():startEarning(); });
  var send=el('chat-send'); if(send) send.addEventListener('click', askSrey);
  var chatText=el('chat-text'); if(chatText) chatText.addEventListener('keydown', function(e){ if(e.key==='Enter') askSrey(); });
  var cashout=el('cashout-btn'); if(cashout) cashout.addEventListener('click', adminCashout);
  var cd=el('close-drawer'); if(cd) cd.addEventListener('click', function(){ el('wallet-drawer').classList.add('hidden'); });
  var cw=el('connect-wallet'); if(cw) cw.addEventListener('click', connectTon);
  var cp=el('connect-phantom'); if(cp) cp.addEventListener('click', connectPhantom);
}
function init(){
  renderCatalog(); setupTabs(); wireUi();
  renderTelemetry(); updateBadges(0, 0); setupFallback();
  var hash=(window.location.hash||'').replace('#','');
  var m=hash.match(/channel=(\w+)/);
  if (m && (m[1]==='live'||m[1]==='merlin')){ if(m[1]==='live'){switchTab('live');loadLive();} else {switchTab('cinema');loadMerlin(0);} }
  else if (hash.indexOf('tab=')===0){ switchTab(hash.substring(4)); }
}
init();
window.UrbanCinema = {
  switchTab:switchTab, loadMerlin:loadMerlin, loadLive:loadLive,
  startEarning:startEarning, stopEarning:stopEarning, askSrey:askSrey,
  loadVault:loadVault, connectTon:connectTon, connectPhantom:connectPhantom,
  get earning(){ return earning; }, get inTelegram(){ return IN_TELEGRAM; }
};
})();
