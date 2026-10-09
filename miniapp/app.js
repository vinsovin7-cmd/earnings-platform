/* miniapp app.js
 - Simple Cinema player (HLS), TonConnect + Phantom connect UI, mock "wallet pay"
 - USD formatting via Intl.NumberFormat
 - Minimal, no build toolchain (static site for Vercel)
*/

const catalog = [
  {
    id: 'bigbuckbunny',
    title: 'Big Buck Bunny (Sample)',
    priceUSD: 1.99,
    src: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
  },
  {
    id: 'sintel',
    title: 'Sintel (Sample)',
    priceUSD: 2.99,
    src: 'https://media.w3.org/2010/05/sintel/trailer_hd.m3u8'
  }
];

const usd = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});

function renderCatalog(){
  const ul = document.getElementById('catalog-list');
  catalog.forEach(item=>{
    const li = document.createElement('li');
    li.innerHTML = `<strong>${item.title}</strong>\n<p>Price: ${usd.format(item.priceUSD)}</p>\n<button data-id="${item.id}" class="watch">Watch / Buy</button>`;
    ul.appendChild(li);
  });
}

function setupPlayer(){
  const video = document.getElementById('video-player');
  document.getElementById('catalog-list').addEventListener('click', (ev)=>{
    const btn = ev.target.closest('button.watch');
    if(!btn) return;
    const id = btn.dataset.id;
    const item = catalog.find(i=>i.id===id);
    if(!item) return;
    loadStream(item.src);
  });
}

function loadStream(src){
  const video = document.getElementById('video-player');
  if(Hls.isSupported()){
    if(window._hls){
      window._hls.destroy();
      window._hls = null;
    }
    const hls = new Hls();
    window._hls = hls;
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, function() {
      video.play().catch(()=>{});
    });
  } else if(video.canPlayType('application/vnd.apple.mpegurl')){
    video.src = src;
    video.addEventListener('loadedmetadata', ()=> video.play().catch(()=>{}));
  } else {
    alert('HLS not supported on this browser');
  }
}

// Wallet integration (TonConnect)
let tonConnect;
let tonAccount = null;
async function connectTon(){
  try{
    tonConnect = new window.TonConnect();
    const res = await tonConnect.requestWallet();
    // requestWallet may open flows; requestPermissions would be later
    document.getElementById('wallet-info').textContent = JSON.stringify({wallet: res}, null, 2);
    document.getElementById('wallet-drawer').classList.remove('hidden');
    tonAccount = res;
  }catch(err){
    console.warn('Ton connect failed', err);
    alert('TonConnect connect failed');
  }
}

// Phantom (Solana) detection + basic connect
async function connectPhantom(){
  try{
    const provider = window.solana;
    if(!provider || !provider.isPhantom){
      alert('Phantom not found; install Phantom or use a supported browser extension');
      return;
    }
    const resp = await provider.connect();
    document.getElementById('wallet-info').textContent = JSON.stringify({phantom: resp.publicKey.toString()}, null, 2);
    document.getElementById('wallet-drawer').classList.remove('hidden');
  }catch(err){
    console.warn('Phantom connect failed', err);
    alert('Phantom connect failed');
  }
}

function payWithWallet(){
  alert('Wallet checkout is unavailable. No payment or payout was made.');
}

function payWithStars(){
  alert('Telegram Stars checkout is unavailable. No invoice was created.');
}

function wireUi(){
  document.getElementById('connect-wallet').addEventListener('click', connectTon);
  document.getElementById('connect-phantom').addEventListener('click', connectPhantom);
  document.getElementById('pay-wallet').addEventListener('click', payWithWallet);
  document.getElementById('pay-stars').addEventListener('click', payWithStars);
  document.getElementById('close-drawer').addEventListener('click', ()=>document.getElementById('wallet-drawer').classList.add('hidden'));
}

renderCatalog();
setupPlayer();
wireUi();

// Expose helpers for debugging
window.UrbanCinema = {catalog, usd, connectTon, connectPhantom};
