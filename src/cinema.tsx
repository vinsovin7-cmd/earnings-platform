import {onCleanup, onMount, Show, createSignal, For, Switch, Match} from 'solid-js';
import {render} from 'solid-js/web';
import EmbeddedBrowserEngine, {CinemaSection} from '@components/EmbeddedBrowserEngine';
import {getNextPlayableIndex} from '@/cinemaQueue';
import {getPlaybackStorageKey, parsePlaybackPosition} from '@/cinemaPlayback';
import {CinemaItem, DEMO_CINEMA_ITEM, getCatalogFailureResult, getCatalogResponseResult, getDemoRetryIndex, HLS_MIME_TYPE} from '@/cinemaCatalog';
import {fetchTonUsdtBalance, formatTonUsdtBalance} from '@/tonUsdt';
import '@/cinema.scss';

const LIVE_STREAM_URL = 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8';
const AJE_URL = 'https://www.aljazeera.com/live';
const DEMO_KEYS_STORAGE_KEY = 'urban-cinema-preview-keys';
const DEMO_CHECK_IN_STORAGE_KEY = 'urban-cinema-preview-check-in';
const PIP_POSITION_STORAGE_KEY = 'urban-cinema-pip-position';

function CinemaPage() {
  const [section, setSection] = createSignal<CinemaSection>('cinema');
  const [items, setItems] = createSignal<CinemaItem[]>([]);
  const [currentIndex, setCurrentIndex] = createSignal(-1);
  const [status, setStatus] = createSignal('Loading the licensed cinema catalog…');
  const [catalogReady, setCatalogReady] = createSignal(false);
  const [fallbackActive, setFallbackActive] = createSignal(false);
  const [fallbackError, setFallbackError] = createSignal(false);
  const [demoSoundEnabled, setDemoSoundEnabled] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [playing, setPlaying] = createSignal(false);
  const [geminiKey, setGeminiKey] = createSignal('');
  const [sreyKey, setSreyKey] = createSignal('');
  const [keysSaved, setKeysSaved] = createSignal(false);
  const [keySettingsMessage, setKeySettingsMessage] = createSignal('');
  const [demoCredits, setDemoCredits] = createSignal(0);
  const [checkInStreak, setCheckInStreak] = createSignal(0);
  const [checkInClaimed, setCheckInClaimed] = createSignal(false);
  const [demoMessage, setDemoMessage] = createSignal('');
  const [mockVerification, setMockVerification] = createSignal<'pending' | 'verified' | 'error'>('pending');
  const [mockVerificationMessage, setMockVerificationMessage] = createSignal('No verification has been simulated.');
  const [mockCheckoutComplete, setMockCheckoutComplete] = createSignal(false);
  const [mockBalance, setMockBalance] = createSignal(0);
  const [mockCheckoutMessage, setMockCheckoutMessage] = createSignal('');
  const [heartbeatActive, setHeartbeatActive] = createSignal(false);
  const [heartbeatTicks, setHeartbeatTicks] = createSignal(0);
  const [selectedGift, setSelectedGift] = createSignal('Starlight box');
  const [giftPreviewMessage, setGiftPreviewMessage] = createSignal('');
  const [referralLink, setReferralLink] = createSignal('');
  const [emailBinding, setEmailBinding] = createSignal('');
  const [telegramContext, setTelegramContext] = createSignal('Browser preview');
  const [miniPlayer, setMiniPlayer] = createSignal(false);
  const [miniPlayerHidden, setMiniPlayerHidden] = createSignal(false);
  const [miniPlayerPosition, setMiniPlayerPosition] = createSignal<{left: number, top: number}>();
  const [miniPlayerMoveMode, setMiniPlayerMoveMode] = createSignal(false);
  const [resumeMessage, setResumeMessage] = createSignal('');
  const [wasPlayingBeforeHide, setWasPlayingBeforeHide] = createSignal(false);
  const [tonWalletAddress, setTonWalletAddress] = createSignal('');
  const [tonWalletOnMainnet, setTonWalletOnMainnet] = createSignal(false);
  const [tonUsdtBalance, setTonUsdtBalance] = createSignal('');
  const [tonWalletStatus, setTonWalletStatus] = createSignal('TON wallet not connected');
  const [tonBalanceLoading, setTonBalanceLoading] = createSignal(false);
  let video: HTMLVideoElement;
  let hls: import('hls.js').default;
  let tonConnectUi: import('@tonconnect/ui').TonConnectUI;
  let unsubscribeWalletStatus: (() => void) | undefined;
  let disposed = false;
  let playbackGeneration = 0;
  let catalogRequest: AbortController;
  let catalogTimeout: number;
  let demoPreviousMuted: boolean | undefined;
  let playbackTimeout: number;
  let dragStart: {pointerX: number, pointerY: number, left: number, top: number};
  let lastPersistedSecond = -1;
  let resumeAppliedGeneration = -1;
  let activePlaybackStorageKey: string;
  let persistenceWarningShown = false;
  let balanceRequest: AbortController;
  let balanceRefreshInterval: number;
  let heartbeatInterval: number | undefined;
  let manifestOrigin = location.origin;
  const unavailableItems = new Set<number>();

  const clearPlaybackTimeout = () => {
    window.clearTimeout(playbackTimeout);
    playbackTimeout = undefined;
  };

  const todayKey = () => new Date().toLocaleDateString('en-CA');

  const savePlaybackPosition = () => {
    const storageKey = activePlaybackStorageKey;
    if(!storageKey || !Number.isFinite(video?.currentTime) || video.currentTime < 0) return;

    const currentSecond = Math.floor(video.currentTime);
    if(currentSecond === lastPersistedSecond && !video.ended) return;

    try {
      localStorage.setItem(storageKey, String(video.currentTime));
      lastPersistedSecond = currentSecond;
    } catch(error) {
      if(!persistenceWarningShown) {
        persistenceWarningShown = true;
        console.warn('Could not persist cinema playback position.', error);
      }
    }
  };

  const restorePlaybackPosition = () => {
    const storageKey = activePlaybackStorageKey;
    if(!storageKey || resumeAppliedGeneration === playbackGeneration) return;
    resumeAppliedGeneration = playbackGeneration;
    try {
      const position = parsePlaybackPosition(localStorage.getItem(storageKey));
      if(position > 0 && Number.isFinite(video.duration) && position < video.duration) {
        video.currentTime = position;
        lastPersistedSecond = Math.floor(position);
        setResumeMessage(`Resumed from ${Math.floor(position / 60)}:${String(Math.floor(position % 60)).padStart(2, '0')}.`);
      } else {
        lastPersistedSecond = -1;
        setResumeMessage('');
      }
    } catch(error) {
      console.warn('Could not restore cinema playback position.', error);
      setResumeMessage('');
    }
  };

  const onMiniPlayerPointerDown = (event: PointerEvent & {currentTarget: HTMLElement}) => {
    if((event.target as HTMLElement).closest('button')) return;
    const player = event.currentTarget.closest('.cinema-grid');
    if(!player) return;
    const bounds = player.getBoundingClientRect();
    dragStart = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      left: bounds.left,
      top: bounds.top
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setMiniPlayerPosition({left: bounds.left, top: bounds.top});
    event.preventDefault();
  };

  const onMiniPlayerPointerMove = (event: PointerEvent) => {
    if(!dragStart) return;
    const player = document.querySelector('.cinema-grid.is-pip');
    if(!player) return;
    const bounds = player.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - bounds.width - 8,
      dragStart.left + event.clientX - dragStart.pointerX));
    const top = Math.max(8, Math.min(window.innerHeight - bounds.height - 8,
      dragStart.top + event.clientY - dragStart.pointerY));
    setMiniPlayerPosition({left, top});
  };

  const onMiniPlayerPointerUp = () => {
    if(!dragStart) return;
    dragStart = undefined;
    persistMiniPlayerPosition();
  };

  const persistMiniPlayerPosition = () => {
    try {
      localStorage.setItem(PIP_POSITION_STORAGE_KEY, JSON.stringify(miniPlayerPosition()));
    } catch(error) {
      console.warn('Could not persist mini-player position.', error);
    }
  };

  const onMiniPlayerMoveKeyDown = (event: KeyboardEvent) => {
    if(event.key === 'Escape') {
      setMiniPlayerMoveMode(false);
      return;
    }
    if(!miniPlayerMoveMode() ||
      (event.key !== 'ArrowUp' && event.key !== 'ArrowDown' &&
        event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;

    const player = document.querySelector('.cinema-grid.is-pip');
    if(!player) return;
    const bounds = player.getBoundingClientRect();
    const position = miniPlayerPosition() || {left: bounds.left, top: bounds.top};
    const delta = event.shiftKey ? 40 : 16;
    const left = position.left + (event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0);
    const top = position.top + (event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0);
    setMiniPlayerPosition({
      left: Math.max(8, Math.min(window.innerWidth - bounds.width - 8, left)),
      top: Math.max(8, Math.min(window.innerHeight - bounds.height - 8, top))
    });
    persistMiniPlayerPosition();
    event.preventDefault();
  };

  const onWindowResize = () => {
    const position = miniPlayerPosition();
    const player = document.querySelector('.cinema-grid.is-pip');
    if(!position || !player) return;
    const bounds = player.getBoundingClientRect();
    setMiniPlayerPosition({
      left: Math.max(8, Math.min(window.innerWidth - bounds.width - 8, position.left)),
      top: Math.max(8, Math.min(window.innerHeight - bounds.height - 8, position.top))
    });
  };

  const onDocumentVisibilityChange = () => {
    if(document.visibilityState === 'hidden') savePlaybackPosition();
  };

  const refreshTonBalance = async(address = tonWalletAddress()) => {
    if(!address || tonBalanceLoading()) return;
    const request = new AbortController();
    balanceRequest = request;
    setTonBalanceLoading(true);
    setTonWalletStatus('Refreshing TON USDt balance…');
    try {
      const balance = await fetchTonUsdtBalance(address, request.signal);
      if(disposed || balanceRequest !== request || tonWalletAddress() !== address) return;
      setTonUsdtBalance(formatTonUsdtBalance(balance));
      setTonWalletStatus('TON mainnet balance');
    } catch(error) {
      if(error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Could not load the TON USDt balance.', error);
      if(balanceRequest === request && tonWalletAddress() === address) {
        setTonWalletStatus('TON USDt balance unavailable');
      }
    } finally {
      if(balanceRequest === request) {
        balanceRequest = undefined;
        if(!disposed) setTonBalanceLoading(false);
      }
    }
  };

  const updateTonWallet = (wallet: {
    account: {
      address: string,
      chain: string
    }
  } | null) => {
    balanceRequest?.abort();
    balanceRequest = undefined;
    window.clearInterval(balanceRefreshInterval);
    setTonBalanceLoading(false);
    setTonUsdtBalance('');

    if(!wallet) {
      setTonWalletAddress('');
      setTonWalletOnMainnet(false);
      setTonWalletStatus('TON wallet not connected');
      return;
    }

    setTonWalletAddress(wallet.account.address);
    const isMainnet = wallet.account.chain === '-239';
    setTonWalletOnMainnet(isMainnet);
    if(!isMainnet) {
      setTonWalletStatus('Connect to TON mainnet to view USDt');
      return;
    }

    setTonWalletStatus('Loading TON USDt balance…');
    void refreshTonBalance(wallet.account.address);
    balanceRefreshInterval = window.setInterval(() => {
      if(document.visibilityState === 'visible') void refreshTonBalance(wallet.account.address);
    }, 60_000);
  };

  const initializeTonConnect = async() => {
    try {
      const {TonConnectUI, THEME} = await import('@tonconnect/ui');
      if(disposed) return;
      tonConnectUi = new TonConnectUI({
        manifestUrl: new URL(
          `/api/tonconnect-manifest?origin=${encodeURIComponent(manifestOrigin)}`,
          location.origin
        ).href,
        uiPreferences: {theme: THEME.DARK}
      });
      tonConnectUi.setConnectionNetwork('-239');
      unsubscribeWalletStatus = tonConnectUi.onStatusChange(updateTonWallet, (error) => {
        console.warn('TON Connect reported a wallet connection error.', error);
        setTonWalletStatus('TON wallet connection needs attention');
      });
      await tonConnectUi.connectionRestored;
    } catch(error) {
      console.error('Could not initialize TON Connect.', error);
      setTonWalletStatus('TON Connect is unavailable in this browser');
    }
  };

  const connectTonWallet = async() => {
    if(!tonConnectUi) {
      setTonWalletStatus('TON Connect is still initializing');
      return;
    }
    try {
      await tonConnectUi.openModal();
    } catch(error) {
      console.error('Could not open the TON Connect wallet picker.', error);
      setTonWalletStatus('Could not open TON Connect');
    }
  };

  const disconnectTonWallet = async() => {
    if(!tonConnectUi) return;
    try {
      await tonConnectUi.disconnect();
    } catch(error) {
      console.error('Could not disconnect the TON wallet.', error);
      setTonWalletStatus('Could not disconnect TON wallet');
    }
  };

  const closeMiniPlayer = () => {
    savePlaybackPosition();
    setWasPlayingBeforeHide(playing());
    video.pause();
    setMiniPlayer(false);
    setMiniPlayerHidden(section() === 'rewards');
  };

  const toggleMiniPlayer = () => {
    if(miniPlayer() && !miniPlayerHidden()) {
      closeMiniPlayer();
      return;
    }
    setMiniPlayer(true);
    setMiniPlayerHidden(false);
    if(wasPlayingBeforeHide() && video.currentSrc) {
      wasPlayingBeforeHide(false);
      void video.play().catch((error) => {
        console.warn('Could not resume playback after restoring the mini-player.', error);
      });
    }
  };

  const saveDemoKeys = (event: SubmitEvent) => {
    event.preventDefault();
    try {
      localStorage.setItem(DEMO_KEYS_STORAGE_KEY, JSON.stringify({
        gemini: geminiKey().trim(),
        srey: sreyKey().trim()
      }));
      setKeysSaved(Boolean(geminiKey().trim() || sreyKey().trim()));
      setKeySettingsMessage('Saved in this browser only. No AI provider is connected.');
    } catch(error) {
      console.error('Could not save preview API keys.', error);
      setKeySettingsMessage('Could not save settings in this browser.');
    }
  };

  const clearDemoKeys = () => {
    try {
      localStorage.removeItem(DEMO_KEYS_STORAGE_KEY);
      setGeminiKey('');
      setSreyKey('');
      setKeysSaved(false);
      setKeySettingsMessage('Saved preview keys were removed from this browser.');
    } catch(error) {
      console.error('Could not remove preview API keys.', error);
      setKeySettingsMessage('Could not remove settings from this browser.');
    }
  };

  const claimDemoCheckIn = () => {
    if(checkInClaimed()) return;
    const today = todayKey();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');
    try {
      const nextStreak = localStorage.getItem(`${DEMO_CHECK_IN_STORAGE_KEY}-day`) === yesterday ?
        checkInStreak() + 1 : 1;
      localStorage.setItem(`${DEMO_CHECK_IN_STORAGE_KEY}-day`, today);
      localStorage.setItem(`${DEMO_CHECK_IN_STORAGE_KEY}-streak`, String(nextStreak));
      setCheckInStreak(nextStreak);
      setCheckInClaimed(true);
      setDemoMessage('Demo check-in recorded on this device. It has no cash value.');
    } catch(error) {
      console.error('Could not save the demo check-in.', error);
      setDemoMessage('Could not save the demo check-in in this browser.');
    }
  };

  const addDemoCredit = (source: 'short video ad' | 'direct-click ad') => {
    setDemoCredits((amount) => Number((amount + 0.5).toFixed(2)));
    setDemoMessage(`+$0.50 simulated USDT for ${source}. No ad was served and no funds were earned.`);
  };

  const createReferralLink = async() => {
    const token = typeof crypto.randomUUID === 'function' ?
      crypto.randomUUID() :
      Math.random().toString(36).slice(2);
    const link = `${location.origin}/cinema?ref=${encodeURIComponent(token)}`;
    setReferralLink(link);
    try {
      await navigator.clipboard.writeText(link);
      setDemoMessage('Preview referral link generated and copied.');
    } catch(error) {
      console.warn('Could not copy preview referral link.', error);
      setDemoMessage('Preview referral link generated. Copy it from the field below.');
    }
  };

  const bindDemoEmail = (event: SubmitEvent) => {
    event.preventDefault();
    setDemoMessage('Email is shown for this preview session only; no verification or KYC was performed.');
  };

  const simulateMockVerification = (verified: boolean) => {
    if(mockCheckoutComplete()) return;
    setMockVerification(verified ? 'verified' : 'error');
    setMockVerificationMessage(verified ?
      'Mock verification succeeded. No account, identity, or provider was contacted.' :
      'Mock verification error: this is a local test result. Try the success simulation to continue.');
    setMockCheckoutMessage('');
  };

  const simulateMockCheckout = () => {
    if(mockVerification() !== 'verified' || mockCheckoutComplete()) return;
    setMockCheckoutComplete(true);
    setMockBalance(2);
    setMockCheckoutMessage('Test-only receipt: $2.00 simulated. No payment was requested or made.');
  };

  const toggleLocalHeartbeat = () => {
    if(heartbeatActive()) {
      window.clearInterval(heartbeatInterval);
      heartbeatInterval = undefined;
      setHeartbeatActive(false);
      return;
    }

    if(!mockCheckoutComplete()) return;
    setHeartbeatActive(true);
    heartbeatInterval = window.setInterval(() => setHeartbeatTicks((ticks) => ticks + 1), 1000);
  };

  const previewSelectedGift = () => {
    setGiftPreviewMessage(`${selectedGift()} selected for preview only. No purchase or delivery is available.`);
  };

  const previewInstantPay = () => {
    setGiftPreviewMessage(`Instant-pay preview for ${selectedGift()}: no payment was requested, and no purchase or delivery occurred.`);
  };

  const destroyHls = () => {
    hls?.destroy();
    hls = undefined;
  };

  const restoreDemoMute = () => {
    if(demoPreviousMuted === undefined) return;
    video.muted = demoPreviousMuted;
    setDemoSoundEnabled(!video.muted);
    demoPreviousMuted = undefined;
  };

  const activateDemoFallback = () => {
    if(fallbackActive()) return;
    demoPreviousMuted = video.muted;
    video.muted = true;
    setDemoSoundEnabled(false);
    setFallbackActive(true);
    setFallbackError(false);
    setCatalogReady(false);
    unavailableItems.clear();
    setItems([DEMO_CINEMA_ITEM]);
    setStatus('The licensed catalog is unavailable. Playing the MDN CC0 demo sample muted.');
    if(section() === 'cinema') void loadItem(0);
  };

  const retryDemoPlayback = () => {
    const retryIndex = getDemoRetryIndex(fallbackActive(), fallbackError(), currentIndex());
    if(retryIndex < 0) return;
    setFallbackError(false);
    void loadItem(retryIndex);
  };

  const failDemoPlayback = (generation: number, error: unknown) => {
    if(disposed || generation !== playbackGeneration) return;
    ++playbackGeneration;
    console.error('MDN CC0 demo video failed.', error);
    clearPlaybackTimeout();
    destroyHls();
    video.pause();
    video.removeAttribute('src');
    video.load();
    setLoading(false);
    setPlaying(false);
    setFallbackError(true);
    setStatus('The MDN demo video could not be loaded. Check your connection and retry the demo.');
  };

  const skipUnavailableItem = (generation: number, error: unknown) => {
    if(disposed || generation !== playbackGeneration) return;

    if(fallbackActive()) {
      failDemoPlayback(generation, error);
      return;
    }

    const failedIndex = currentIndex();
    unavailableItems.add(failedIndex);
    ++playbackGeneration;
    console.error('Cinema media source failed.', error);
    clearPlaybackTimeout();
    destroyHls();
    setLoading(false);
    setPlaying(false);

    const nextIndex = getNextPlayableIndex(failedIndex, items().length, unavailableItems);
    if(nextIndex < 0) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      setStatus('No playable titles remain in the configured catalog.');
      return;
    }

    setStatus(`Skipping unavailable title. Loading ${items()[nextIndex].title}…`);
    queueMicrotask(() => void loadItem(nextIndex));
  };

  const playCurrent = async(generation: number) => {
    try {
      await video.play();
      if(disposed || generation !== playbackGeneration) return;
      setStatus('Now playing.');
    } catch(error) {
      if(disposed || generation !== playbackGeneration) return;
      if(error instanceof DOMException && error.name === 'NotAllowedError') {
        setStatus('Playback needs your permission. Select Play to continue.');
      } else {
        console.error('Cinema playback could not start.', error);
        setStatus('Playback could not start. Please try again.');
      }
    }
  };

  const loadItem = async(index: number, autoplay = true) => {
    const item = items()[index];
    if(!item || disposed) return;
    const generation = ++playbackGeneration;

    savePlaybackPosition();
    activePlaybackStorageKey = getPlaybackStorageKey(item);
    clearPlaybackTimeout();
    setCurrentIndex(index);
    setSection('cinema');
    setLoading(true);
    setPlaying(false);
    setStatus(`Loading ${item.title}…`);
    lastPersistedSecond = -1;
    setResumeMessage('');
    destroyHls();
    video.pause();
    video.removeAttribute('src');

    if(video.canPlayType(item.type)) {
      playbackTimeout = window.setTimeout(() => {
        skipUnavailableItem(generation, new Error('Timed out while loading the stream.'));
      }, 20_000);
      video.src = item.src;
      video.load();
      if(autoplay) void playCurrent(generation);
      return;
    }

    if(item.type !== HLS_MIME_TYPE) {
      skipUnavailableItem(generation, new Error('Unsupported media format.'));
      return;
    }

    playbackTimeout = window.setTimeout(() => {
      skipUnavailableItem(generation, new Error('Timed out while loading the stream.'));
    }, 20_000);

    try {
      const {default: Hls} = await import('hls.js');
      if(disposed || generation !== playbackGeneration) return;
      if(!Hls.isSupported()) {
        skipUnavailableItem(generation, new Error('HLS playback is not supported.'));
        return;
      }

      hls = new Hls();
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if(disposed || generation !== playbackGeneration) return;
        clearPlaybackTimeout();
        setLoading(false);
        setStatus(`Ready: ${item.title}.`);
        if(autoplay) void playCurrent(generation);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if(data.fatal && !disposed && generation === playbackGeneration) {
          skipUnavailableItem(generation, data);
        }
      });
      hls.loadSource(item.src);
      hls.attachMedia(video);
    } catch(error) {
      if(disposed || generation !== playbackGeneration) return;
      skipUnavailableItem(generation, error);
    }
  };

  const loadLiveStream = async() => {
    restoreDemoMute();
    setFallbackActive(false);
    setFallbackError(false);
    const generation = ++playbackGeneration;
    savePlaybackPosition();
    activePlaybackStorageKey = undefined;
    clearPlaybackTimeout();
    setSection('live');
    setCurrentIndex(-1);
    setLoading(true);
    setPlaying(false);
    setStatus('Connecting to Al Jazeera English live…');
    setMiniPlayer(false);
    setMiniPlayerHidden(false);
    destroyHls();
    video.pause();
    video.removeAttribute('src');

    if(video.canPlayType(HLS_MIME_TYPE)) {
      playbackTimeout = window.setTimeout(() => {
        if(disposed || generation !== playbackGeneration) return;
        ++playbackGeneration;
        clearPlaybackTimeout();
        setLoading(false);
        setStatus('The live feed did not respond. Open Al Jazeera’s official live page.');
      }, 20_000);
      video.src = LIVE_STREAM_URL;
      video.load();
      void playCurrent(generation);
      return;
    }

    playbackTimeout = window.setTimeout(() => {
      if(disposed || generation !== playbackGeneration) return;
      ++playbackGeneration;
      clearPlaybackTimeout();
      destroyHls();
      setLoading(false);
      setStatus('The live feed did not respond. Open Al Jazeera’s official live page.');
    }, 20_000);

    try {
      const {default: Hls} = await import('hls.js');
      if(disposed || generation !== playbackGeneration) return;
      if(!Hls.isSupported()) {
        clearPlaybackTimeout();
        setLoading(false);
        setStatus('Live HLS playback is not supported in this browser.');
        return;
      }

      hls = new Hls();
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if(disposed || generation !== playbackGeneration) return;
        clearPlaybackTimeout();
        setLoading(false);
        void playCurrent(generation);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if(data.fatal && !disposed && generation === playbackGeneration) {
          console.error('Al Jazeera English live stream failed.', data);
          ++playbackGeneration;
          clearPlaybackTimeout();
          destroyHls();
          setLoading(false);
          setStatus('The live feed is unavailable here. Open Al Jazeera’s official live page.');
        }
      });
      hls.loadSource(LIVE_STREAM_URL);
      hls.attachMedia(video);
    } catch(error) {
      if(disposed || generation !== playbackGeneration) return;
      clearPlaybackTimeout();
      console.error('Could not initialize the live HLS stream.', error);
      setLoading(false);
      setStatus('The live player could not be initialized.');
    }
  };

  const loadCatalog = async() => {
    catalogRequest?.abort();
    const request = new AbortController();
    catalogRequest = request;
    let timedOut = false;
    const requestTimeout = window.setTimeout(() => {
      timedOut = true;
      request.abort();
    }, 12_000);

    try {
      const response = await fetch('/api/cinema-catalog', {
        headers: {Accept: 'application/json'},
        signal: request.signal
      });
      if(!response.ok) {
        if(response.status !== 503) console.error('Cinema catalog request failed.', response.status);
        activateDemoFallback();
        return;
      }

      const payload: unknown = await response.json();
      const result = getCatalogResponseResult(true, payload);
      if(result.kind === 'fallback') {
        console.error('Cinema catalog response has an invalid schema.');
        activateDemoFallback();
        return;
      }

      const wasFallback = fallbackActive() || items().some((item) => item.id === DEMO_CINEMA_ITEM.id);
      if(wasFallback) restoreDemoMute();
      setFallbackActive(false);
      setFallbackError(false);
      setItems(result.items);
      setCatalogReady(true);
      setStatus(result.items.length ?
        `${result.items.length} licensed episodes ready to play.` :
        'No licensed episodes are available in the catalog yet.');
      if(wasFallback && section() === 'cinema') {
        unavailableItems.clear();
        if(result.items.length) {
          void loadItem(0);
        } else {
          savePlaybackPosition();
          ++playbackGeneration;
          clearPlaybackTimeout();
          destroyHls();
          video.pause();
          video.removeAttribute('src');
          video.load();
          activePlaybackStorageKey = undefined;
          setCurrentIndex(-1);
          setLoading(false);
          setPlaying(false);
        }
      }
    } catch(error) {
      const result = getCatalogFailureResult(request.signal.aborted, timedOut);
      if(result.kind === 'aborted') return;
      console.error('Cinema catalog could not be loaded.', error);
      activateDemoFallback();
    } finally {
      window.clearTimeout(requestTimeout);
      if(catalogRequest === request) catalogRequest = undefined;
    }
  };

  const advanceQueue = () => {
    const nextIndex = getNextPlayableIndex(currentIndex(), items().length, unavailableItems);
    if(nextIndex < 0) {
      setPlaying(false);
      setStatus('No playable titles remain in the configured catalog.');
      return;
    }
    void loadItem(nextIndex);
  };

  const selectItem = (index: number) => {
    unavailableItems.clear();
    void loadItem(index);
  };

  const selectSection = (nextSection: CinemaSection) => {
    if(nextSection === 'live') {
      void loadLiveStream();
      return;
    }
    if(nextSection === 'shop') {
      setSection('shop');
      if(video.currentSrc || video.src) {
        setMiniPlayer(true);
        setMiniPlayerHidden(false);
      }
      return;
    }
    if(nextSection === 'cinema') {
      if(section() === 'cinema') return;
      unavailableItems.clear();
      setMiniPlayer(false);
      setMiniPlayerHidden(false);
      if(section() === 'rewards' && currentIndex() > -1) setSection('cinema');
      else if(items().some((item) => item.id === DEMO_CINEMA_ITEM.id)) void loadItem(currentIndex() > -1 ? currentIndex() : 0);
      else if(items().length) void loadItem(currentIndex() > -1 ? currentIndex() : 0);
      else setSection('cinema');
      return;
    }
    setSection('rewards');
    if(video.currentSrc || video.src) {
      setMiniPlayer(true);
      setMiniPlayerHidden(false);
    }
    setStatus('Earnings are unavailable until a verified rewards service is configured.');
  };

  onMount(() => {
    manifestOrigin = window.location.origin;
    const webApp = (window as Window & {
      Telegram?: {
        WebApp?: {
          ready?: () => void,
          expand?: () => void,
          initDataUnsafe?: {
            user?: {
              first_name?: string
            }
          }
        }
      }
    }).Telegram?.WebApp;
    webApp?.ready?.();
    webApp?.expand?.();
    if(webApp) {
      setTelegramContext(webApp.initDataUnsafe?.user?.first_name ?
        `Telegram preview · ${webApp.initDataUnsafe.user.first_name}` :
        'Telegram WebApp preview');
    }
    void initializeTonConnect();
    try {
      const savedKeys: unknown = JSON.parse(localStorage.getItem(DEMO_KEYS_STORAGE_KEY) || '{}');
      if(savedKeys && typeof savedKeys === 'object') {
        const keys = savedKeys as Record<string, unknown>;
        if(typeof keys.gemini === 'string') setGeminiKey(keys.gemini);
        if(typeof keys.srey === 'string') setSreyKey(keys.srey);
        setKeysSaved(Boolean(keys.gemini || keys.srey));
      }
      const lastCheckIn = localStorage.getItem(`${DEMO_CHECK_IN_STORAGE_KEY}-day`);
      const savedStreak = Number(localStorage.getItem(`${DEMO_CHECK_IN_STORAGE_KEY}-streak`));
      if(Number.isInteger(savedStreak) && savedStreak > 0) setCheckInStreak(savedStreak);
      setCheckInClaimed(lastCheckIn === todayKey());
      const savedPosition: unknown = JSON.parse(localStorage.getItem(PIP_POSITION_STORAGE_KEY) || 'null');
      if(savedPosition && typeof savedPosition === 'object' &&
        'left' in savedPosition && 'top' in savedPosition &&
        typeof savedPosition.left === 'number' && Number.isFinite(savedPosition.left) &&
        typeof savedPosition.top === 'number' && Number.isFinite(savedPosition.top)) {
        setMiniPlayerPosition({left: savedPosition.left, top: savedPosition.top});
      }
    } catch(error) {
      console.error('Could not load preview settings.', error);
      setKeySettingsMessage('Preview settings could not be loaded from this browser.');
    }
    void loadCatalog();
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('pagehide', savePlaybackPosition);
    document.addEventListener('visibilitychange', onDocumentVisibilityChange);

    onCleanup(() => {
      disposed = true;
      ++playbackGeneration;
      savePlaybackPosition();
      clearPlaybackTimeout();
      catalogRequest?.abort();
      destroyHls();
      video.pause();
      video.removeAttribute('src');
      video.load();
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('pagehide', savePlaybackPosition);
      document.removeEventListener('visibilitychange', onDocumentVisibilityChange);
      balanceRequest?.abort();
      balanceRequest = undefined;
      window.clearInterval(balanceRefreshInterval);
      window.clearInterval(heartbeatInterval);
      unsubscribeWalletStatus?.();
    });
  });

  return (
    <EmbeddedBrowserEngine
      activeSection={section()}
      onSectionChange={selectSection}
      headerStatus={
        <div class="cinema-header-wallet" aria-live="polite">
          <Show when={tonWalletAddress()} fallback={
            <button
              class="cinema-header-wallet-button"
              type="button"
              onClick={() => void connectTonWallet()}
            >
              Connect TON
            </button>
          }>
            <span class="cinema-header-wallet-balance">
              {!tonWalletOnMainnet() ? 'TON testnet' :
                tonBalanceLoading() ? 'Loading USDt…' : `${tonUsdtBalance() || '—'} USDt`}
            </span>
            <button
              class="cinema-header-wallet-button"
              type="button"
              disabled={!tonWalletOnMainnet() || tonBalanceLoading()}
              aria-label="Refresh TON USDt balance"
              onClick={() => void refreshTonBalance()}
            >
              ↻
            </button>
          </Show>
        </div>
      }
    >
      <section class="cinema-content" aria-label="Urban Cinema">
        <div class="cinema-heading">
          <Switch>
            <Match when={section() === 'cinema'}>
              <div>
                <p class="cinema-eyebrow">YOUR PRIVATE SCREENING ROOM</p>
                <h1>Settle in.</h1>
                <p class="cinema-intro">A considered collection of stories, ready when you are.</p>
              </div>
              <span class="cinema-quality"><span aria-hidden="true">●</span> CURATED PLAYLIST</span>
            </Match>
            <Match when={section() === 'live'}>
              <div>
                <p class="cinema-eyebrow">INTERNATIONAL NEWS</p>
                <h1>Al Jazeera English</h1>
                <p class="cinema-intro">Live coverage from Al Jazeera’s official English-language channel.</p>
              </div>
              <span class="cinema-live"><span class="cinema-live-dot" aria-hidden="true"></span> LIVE</span>
            </Match>
            <Match when={section() === 'rewards'}>
              <div>
                <p class="cinema-eyebrow">TRANSPARENT BY DESIGN</p>
                <h1>Rewards</h1>
                <p class="cinema-intro">No estimated balance is shown until it is verified by the service.</p>
              </div>
              <span class="cinema-rewards-status">NOT CONFIGURED</span>
            </Match>
            <Match when={section() === 'shop'}>
              <div>
                <p class="cinema-eyebrow">CURATED GIFTS · PREVIEW ONLY</p>
                <h1>SreyShop</h1>
                <p class="cinema-intro">Explore decorative gift concepts. No inventory or checkout is connected.</p>
              </div>
              <span class="cinema-rewards-status">NO PURCHASES</span>
            </Match>
          </Switch>
          <Show when={section() !== 'shop' || video?.currentSrc || video?.src}>
            <button
              class="cinema-control cinema-control-subtle cinema-pip-toggle"
              type="button"
              aria-pressed={miniPlayer() && !miniPlayerHidden()}
              onClick={toggleMiniPlayer}
            >
              {miniPlayer() && !miniPlayerHidden() ? 'Return to cinema' : 'Open mini-player'}
            </button>
          </Show>
        </div>

        <div
          class="cinema-grid"
          classList={{'is-pip': miniPlayer() && !miniPlayerHidden()}}
          hidden={(section() === 'rewards' || section() === 'shop') && (!miniPlayer() || miniPlayerHidden())}
          style={{
            left: miniPlayer() && miniPlayerPosition() ? `${miniPlayerPosition().left}px` : undefined,
            top: miniPlayer() && miniPlayerPosition() ? `${miniPlayerPosition().top}px` : undefined,
            right: miniPlayer() && miniPlayerPosition() ? 'auto' : undefined,
            bottom: miniPlayer() && miniPlayerPosition() ? 'auto' : undefined
          }}
        >
          <div class="cinema-main-column">
            <div class="cinema-player" classList={{'cinema-live-player': section() === 'live'}}>
              <Show when={miniPlayer() && !miniPlayerHidden()}>
                <div
                  class="cinema-pip-bar"
                  role="group"
                  aria-label="Mini-player controls. Drag to move, or select Move and use arrow keys."
                  onPointerDown={onMiniPlayerPointerDown}
                  onPointerMove={onMiniPlayerPointerMove}
                  onPointerUp={onMiniPlayerPointerUp}
                  onPointerCancel={onMiniPlayerPointerUp}
                  onKeyDown={onMiniPlayerMoveKeyDown}
                >
                  <span class="cinema-pip-title">{items()[currentIndex()]?.title || 'Al Jazeera English'}</span>
                  <button
                    class="cinema-pip-move"
                    type="button"
                    aria-pressed={miniPlayerMoveMode()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setMiniPlayerMoveMode(!miniPlayerMoveMode())}
                  >
                    {miniPlayerMoveMode() ? 'Move: arrows · Esc to finish' : 'Move'}
                  </button>
                  <button
                    class="cinema-pip-close"
                    type="button"
                    aria-label="Hide mini-player"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={closeMiniPlayer}
                  >
                    ×
                  </button>
                </div>
              </Show>
              <video
                ref={video}
                id="cinema-video"
                controls
                playsinline
                preload="auto"
                aria-label={section() === 'live' ? 'Al Jazeera English live stream' : 'Cinema video player'}
                onVolumeChange={() => {
                  if(fallbackActive()) setDemoSoundEnabled(!video.muted);
                }}
                onPlay={() => {
                  setPlaying(true);
                  setStatus('Now playing.');
                }}
                onPause={() => setPlaying(false)}
                onTimeUpdate={savePlaybackPosition}
                onLoadedMetadata={() => {
                  if(section() === 'cinema') {
                    restorePlaybackPosition();
                    if(video.paused) void playCurrent(playbackGeneration);
                  }
                }}
                onLoadedData={() => {
                  clearPlaybackTimeout();
                  setLoading(false);
                  if(section() === 'cinema') {
                    setStatus(`Ready: ${items()[currentIndex()]?.title || 'your title'}.`);
                  }
                }}
                onEnded={() => {
                  savePlaybackPosition();
                  if(section() === 'cinema') advanceQueue();
                }}
                onError={(event) => {
                  const error = event.currentTarget.error;
                  if(!error || disposed) return;
                  if(section() === 'cinema') {
                    const item = items()[currentIndex()];
                    if(item && !hls &&
                      event.currentTarget.currentSrc === new URL(item.src, location.href).href) {
                      skipUnavailableItem(playbackGeneration, error);
                    }
                    return;
                  }
                  console.error('Al Jazeera English live media playback failed.', error);
                  ++playbackGeneration;
                  clearPlaybackTimeout();
                  setLoading(false);
                  setStatus('The live feed is unavailable in this browser or region.');
                }}
              />
              <Show when={loading()}>
                <div class="cinema-loading" role="status">
                  {section() === 'live' ? 'Connecting to the official live feed…' : 'Preparing your stream…'}
                </div>
              </Show>
              <Show when={section() === 'cinema' && !items().length}>
                <div class="cinema-player-empty">
                  <span class="cinema-empty-mark" aria-hidden="true">U</span>
                  <strong>Your next story starts here</strong>
                  <span>Licensed titles will appear when the cinema catalog is configured.</span>
                </div>
              </Show>
            </div>
            <Switch>
              <Match when={section() === 'cinema'}>
                <div class="cinema-now-playing">
                  <div>
                    <p class="cinema-eyebrow">NOW SHOWING</p>
                    <h2>{items()[currentIndex()]?.title || 'Choose a title to begin'}</h2>
                    <p role={fallbackError() ? 'status' : undefined}>{status()}</p>
                    <Show when={fallbackActive()}>
                      <p class="cinema-demo-note">
                        Demo preview only — this MDN CC0 sample is not part of your licensed cinema catalog.
                      </p>
                    </Show>
                    <Show when={resumeMessage()}>
                      <p class="cinema-resume-status">{resumeMessage()}</p>
                    </Show>
                  </div>
                  <div class="cinema-player-actions">
                    <button
                      class="cinema-control"
                      type="button"
                      disabled={(!catalogReady() && !fallbackActive()) || !items().length || loading() || fallbackError()}
                      onClick={() => selectItem(currentIndex() > -1 ? currentIndex() : 0)}
                    >
                      {playing() ? 'Restart title' : 'Play title'}
                    </button>
                    <button
                      class="cinema-control cinema-control-subtle"
                      type="button"
                      disabled={!items().length}
                      onClick={advanceQueue}
                    >
                      Next title
                    </button>
                  </div>
                </div>
                <p class="cinema-audio-note">Playback may require a tap in embedded browsers. Use the player controls to adjust volume.</p>
                <Show when={fallbackActive()}>
                  <div class="cinema-demo-actions">
                    <label class="cinema-demo-audio">
                      <input
                        type="checkbox"
                        checked={demoSoundEnabled()}
                        onChange={(event) => {
                          setDemoSoundEnabled(event.currentTarget.checked);
                          video.muted = !event.currentTarget.checked;
                        }}
                      />
                      Enable sound for the demo video
                    </label>
                    <button class="cinema-control cinema-control-subtle" type="button" onClick={() => void loadCatalog()}>
                      Retry licensed catalog
                    </button>
                    <Show when={fallbackError()}>
                      <button class="cinema-control" type="button" onClick={retryDemoPlayback}>
                        Retry demo video
                      </button>
                    </Show>
                  </div>
                </Show>
              </Match>
              <Match when={section() === 'live'}>
                <aside class="cinema-live-details">
                  <span class="cinema-live-symbol" aria-hidden="true">LIVE</span>
                  <h2>Independent journalism, live.</h2>
                  <p>The stream is delivered by Al Jazeera’s official live media source. Availability and playback restrictions are controlled by the publisher.</p>
                  <a href={AJE_URL} target="_blank" rel="noopener noreferrer">Open Al Jazeera live <span aria-hidden="true">↗</span></a>
                  <Show when={!playing() && !loading()}>
                    <button class="cinema-control" type="button" onClick={() => void loadLiveStream()}>
                      {status().includes('unavailable') ? 'Try live stream again' : 'Start live stream'}
                    </button>
                  </Show>
                </aside>
              </Match>
            </Switch>
          </div>
          <Show when={section() === 'cinema'}>
            <aside class="cinema-queue" aria-labelledby="queue-title">
              <div class="cinema-queue-heading">
                <div>
                  <p class="cinema-eyebrow">UP NEXT</p>
                  <h2 id="queue-title">The collection</h2>
                </div>
                <span>{items().length.toString().padStart(2, '0')}</span>
              </div>
              <Show when={items().length} fallback={
                <div class="cinema-queue-empty">
                  <p>Featured collections</p>
                  <div>Merlin <span>Seasons 1–5 · source not configured</span></div>
                  <div>Legend of the Seeker <span>Source not configured</span></div>
                  <small>Episode streams must come from your licensed catalog.</small>
                </div>
              }>
                <ol class="cinema-queue-list">
                  <For each={items()}>{(item, index) =>
                    <li>
                      <button
                        type="button"
                        class="cinema-queue-item"
                        classList={{'is-current': currentIndex() === index()}}
                        aria-current={currentIndex() === index() ? 'true' : undefined}
                        onClick={() => selectItem(index())}
                      >
                        <span class="cinema-queue-index">{(index() + 1).toString().padStart(2, '0')}</span>
                        <span class="cinema-queue-copy">
                          <strong>{item.title}</strong>
                          <small>{fallbackActive() ? 'Demo sample · MDN CC0' : `${item.series} · S${item.season} · E${item.episode}`}</small>
                        </span>
                        <span class="cinema-queue-play" aria-hidden="true">▶</span>
                      </button>
                    </li>
                  }</For>
                </ol>
              </Show>
            </aside>
          </Show>
        </div>

        <Show when={section() === 'shop'}>
          <section class="cinema-shop" aria-labelledby="sreyshop-title">
            <div class="cinema-shop-heading">
              <div>
                <p class="cinema-eyebrow">A GIFTING CONCEPT</p>
                <h2 id="sreyshop-title">The SreyShop collection</h2>
                <p>Preview gift concepts and their interface states. Items shown here are not for sale.</p>
              </div>
              <span class="cinema-preview-badge">LOCAL PREVIEW · NO INVENTORY</span>
            </div>

            <section class="cinema-shop-wallet" aria-labelledby="shop-wallet-title">
              <div>
                <p class="cinema-eyebrow">READ-ONLY WALLET DISPLAY</p>
                <h3 id="shop-wallet-title">TON balance binding</h3>
              </div>
              <p class="cinema-shop-wallet-state">
                <strong>{tonWalletAddress() ? tonWalletOnMainnet() ? 'TON mainnet connected' : 'Wallet connected · mainnet required' : 'Wallet not connected'}</strong>
                <span>{tonWalletStatus()}</span>
              </p>
              <p class="cinema-shop-wallet-balance">
                {tonWalletAddress() && tonWalletOnMainnet() ?
                  `${tonUsdtBalance() || '—'} USDt` :
                  'Balance unavailable'}
              </p>
              <Show when={!tonWalletAddress()} fallback={
                <div class="cinema-shop-wallet-actions">
                  <button
                    class="cinema-control cinema-control-subtle"
                    type="button"
                    disabled={!tonWalletOnMainnet() || tonBalanceLoading()}
                    onClick={() => void refreshTonBalance()}
                  >
                    {tonBalanceLoading() ? 'Refreshing read-only balance…' : 'Refresh read-only balance'}
                  </button>
                  <button
                    class="cinema-control cinema-control-subtle"
                    type="button"
                    onClick={() => void disconnectTonWallet()}
                  >
                    Disconnect wallet
                  </button>
                </div>
              }>
                <button class="cinema-control cinema-control-subtle" type="button" onClick={() => void connectTonWallet()}>
                  Connect wallet to view balance
                </button>
              </Show>
              <small>This is a read-only public wallet balance, not SreyShop credit. No payment or token approval is requested.</small>
            </section>

            <div class="cinema-shop-grid" role="group" aria-label="Decorative gift previews">
              <article class="cinema-shop-gift" classList={{'is-selected': selectedGift() === 'Starlight box'}}>
                <span class="cinema-shop-gift-art" aria-hidden="true">✧</span>
                <p class="cinema-eyebrow">GIFT CONCEPT 01</p>
                <h3>Starlight box</h3>
                <p>A decorative gift concept for previewing the selection flow.</p>
                <span class="cinema-shop-gift-label">Preview item · not for sale</span>
                <button
                  class="cinema-control cinema-control-subtle"
                  type="button"
                  aria-pressed={selectedGift() === 'Starlight box'}
                  onClick={() => {
                    setSelectedGift('Starlight box');
                    setGiftPreviewMessage('Starlight box selected. Preview only; no purchase or delivery.');
                  }}
                >
                  {selectedGift() === 'Starlight box' ? 'Selected' : 'Select gift'}
                </button>
              </article>
              <article class="cinema-shop-gift" classList={{'is-selected': selectedGift() === 'Moon pin'}}>
                <span class="cinema-shop-gift-art" aria-hidden="true">☾</span>
                <p class="cinema-eyebrow">GIFT CONCEPT 02</p>
                <h3>Moon pin</h3>
                <p>A decorative gift concept for previewing the selection flow.</p>
                <span class="cinema-shop-gift-label">Preview item · not for sale</span>
                <button
                  class="cinema-control cinema-control-subtle"
                  type="button"
                  aria-pressed={selectedGift() === 'Moon pin'}
                  onClick={() => {
                    setSelectedGift('Moon pin');
                    setGiftPreviewMessage('Moon pin selected. Preview only; no purchase or delivery.');
                  }}
                >
                  {selectedGift() === 'Moon pin' ? 'Selected' : 'Select gift'}
                </button>
              </article>
            </div>

            <section class="cinema-shop-preview" aria-labelledby="gift-preview-title">
              <div>
                <p class="cinema-eyebrow">INTERACTION PREVIEW</p>
                <h3 id="gift-preview-title">{selectedGift()}</h3>
                <p>Instant-pay screen preview only. Nothing will be charged, transferred, reserved, or delivered.</p>
              </div>
              <div class="cinema-preview-actions">
                <button class="cinema-control" type="button" onClick={previewSelectedGift}>Preview gift selection</button>
                <button class="cinema-control cinema-control-subtle" type="button" onClick={previewInstantPay}>
                  Preview instant-pay state
                </button>
              </div>
              <p class="cinema-preview-status" role="status">
                {giftPreviewMessage() || 'Select a gift or preview the instant-pay state. No purchase is available.'}
              </p>
            </section>
          </section>
        </Show>

        <Show when={section() === 'rewards'}>
          <section class="cinema-rewards-card" aria-labelledby="rewards-title">
            <span class="cinema-rewards-icon" aria-hidden="true">◇</span>
            <h2 id="rewards-title">Verified earnings are not available yet</h2>
            <p>Viewing time stored in this browser is not proof of a completed task, and it cannot authorize a blockchain payout. A verified account, persistent rewards ledger and payout service must be configured before earnings can be enabled.</p>
            <a href="https://ton.org/wallets" target="_blank" rel="noopener noreferrer">Explore TON wallets <span aria-hidden="true">↗</span></a>
            <section class="cinema-preview-tools" aria-labelledby="preview-tools-title">
              <div class="cinema-preview-heading">
                <div>
                  <p class="cinema-eyebrow">LOCAL PREVIEW ONLY</p>
                  <h3 id="preview-tools-title">Sandbox tools</h3>
                </div>
                <span class="cinema-preview-badge">NOT CONNECTED</span>
              </div>
              <p class="cinema-preview-notice">
                Demo controls do not verify Telegram users, contact providers, serve ads, earn USDT, or make payouts.
              </p>

              <form class="cinema-preview-form" onSubmit={saveDemoKeys}>
                <h4>API key settings</h4>
                <p>Keys are saved as plain browser storage on this device. They are not encrypted, sent to a provider, or used by this preview.</p>
                <label>
                  Gemini API key
                  <input
                    type="password"
                    name="gemini-key"
                    autoComplete="off"
                    value={geminiKey()}
                    onInput={(event) => {
                      setGeminiKey(event.currentTarget.value);
                      setKeysSaved(false);
                      setKeySettingsMessage('');
                    }}
                  />
                </label>
                <label>
                  Srey API key
                  <input
                    type="password"
                    name="srey-key"
                    autoComplete="off"
                    value={sreyKey()}
                    onInput={(event) => {
                      setSreyKey(event.currentTarget.value);
                      setKeysSaved(false);
                      setKeySettingsMessage('');
                    }}
                  />
                </label>
                <div class="cinema-preview-actions">
                  <button class="cinema-control" type="submit">Save on this device</button>
                  <button class="cinema-control cinema-control-subtle" type="button" onClick={clearDemoKeys}>Remove saved keys</button>
                </div>
                <p class="cinema-preview-status" role="status">
                  {keySettingsMessage() || (keysSaved() ?
                    'Preview keys are saved locally; no provider is connected.' :
                    'No saved preview keys. Unsaved input stays in this session.')}
                </p>
              </form>

              <div class="cinema-preview-grid">
                <section class="cinema-preview-card" aria-labelledby="telegram-preview-title">
                  <h4 id="telegram-preview-title">Telegram session</h4>
                  <p>{telegramContext()}</p>
                  <small>Display context only; WebApp data is not server-verified.</small>
                </section>
                <section class="cinema-preview-card" aria-labelledby="checkin-title">
                  <h4 id="checkin-title">Daily check-in · demo</h4>
                  <p>Preview streak: <strong>{checkInStreak()}</strong> day{checkInStreak() === 1 ? '' : 's'}</p>
                  <button
                    class="cinema-control"
                    type="button"
                    disabled={checkInClaimed()}
                    onClick={claimDemoCheckIn}
                  >
                    {checkInClaimed() ? 'Checked in today' : 'Record demo check-in'}
                  </button>
                </section>
                <section class="cinema-preview-card" aria-labelledby="referral-title">
                  <h4 id="referral-title">Referral preview</h4>
                  <button class="cinema-control" type="button" onClick={() => void createReferralLink()}>
                    Generate preview link
                  </button>
                  <Show when={referralLink()}>
                    <label>
                      Local preview link
                      <input type="text" value={referralLink()} readOnly />
                    </label>
                  </Show>
                  <small>Links are not tracked and generate no commission.</small>
                </section>
                <section class="cinema-preview-card" aria-labelledby="email-binding-title">
                  <h4 id="email-binding-title">Email binding preview</h4>
                  <form class="cinema-preview-inline-form" onSubmit={bindDemoEmail}>
                    <label>
                      Email address
                      <input
                        type="email"
                        name="preview-email"
                        autoComplete="email"
                        required
                        value={emailBinding()}
                        onInput={(event) => setEmailBinding(event.currentTarget.value)}
                      />
                    </label>
                    <button class="cinema-control" type="submit">Preview binding</button>
                  </form>
                  <small>No email is sent; this is not identity verification or KYC.</small>
                </section>
                <section class="cinema-preview-card" aria-labelledby="wallet-preview-title">
                  <h4 id="wallet-preview-title">TON wallet &amp; USDt</h4>
                  <p>{tonWalletStatus()}</p>
                  <Show when={tonWalletAddress()}>
                    <p class="cinema-wallet-address">{tonWalletAddress()}</p>
                    <p><strong>{tonWalletOnMainnet() ? `${tonUsdtBalance() || '—'} USDt` : 'Mainnet required'}</strong>
                      {tonWalletOnMainnet() ? ' · TON mainnet' : ''}
                    </p>
                    <div class="cinema-preview-actions">
                      <button
                        class="cinema-control"
                        type="button"
                        disabled={!tonWalletOnMainnet() || tonBalanceLoading()}
                        onClick={() => void refreshTonBalance()}
                      >
                        Refresh balance
                      </button>
                      <button
                        class="cinema-control cinema-control-subtle"
                        type="button"
                        onClick={() => void disconnectTonWallet()}
                      >
                        Disconnect
                      </button>
                    </div>
                  </Show>
                  <Show when={!tonWalletAddress()}>
                    <button class="cinema-control" type="button" onClick={() => void connectTonWallet()}>
                      Connect Tonkeeper or Telegram Wallet
                    </button>
                  </Show>
                  <small>Read-only balance from TON Center. This app never requests a transaction or token approval.</small>
                </section>
              </div>

              <section class="cinema-preview-mock" aria-labelledby="mock-rewards-title">
                <div class="cinema-preview-heading">
                  <div>
                    <p class="cinema-eyebrow">PREVIEW / MOCK ONLY</p>
                    <h3 id="mock-rewards-title">VIP onboarding sandbox</h3>
                  </div>
                  <span class="cinema-preview-badge">NO REAL VERIFICATION OR PAYMENT</span>
                </div>
                <div class="cinema-preview-grid cinema-mock-grid">
                  <section class="cinema-preview-card" aria-labelledby="mock-verification-title">
                    <h4 id="mock-verification-title">Google/YouTube verification simulation</h4>
                    <p>Use the buttons to change local demo state. No Google credentials, password, token, provider, or redirect is involved.</p>
                    <div class="cinema-preview-actions">
                      <button
                        class="cinema-control"
                        type="button"
                        disabled={mockCheckoutComplete()}
                        onClick={() => simulateMockVerification(true)}
                      >
                        Simulate verification success
                      </button>
                      <button
                        class="cinema-control cinema-control-subtle"
                        type="button"
                        disabled={mockCheckoutComplete()}
                        onClick={() => simulateMockVerification(false)}
                      >
                        Show mock verification error
                      </button>
                    </div>
                    <p class="cinema-preview-status" role="status">{mockVerificationMessage()}</p>
                  </section>

                  <section class="cinema-preview-card" aria-labelledby="mock-checkout-title">
                    <h4 id="mock-checkout-title">Fixed $2.00 test checkout</h4>
                    <p>This button only simulates a checkout locally. There are no card fields, payment provider, network request, or real charge.</p>
                    <button
                      class="cinema-control"
                      type="button"
                      disabled={mockVerification() !== 'verified' || mockCheckoutComplete()}
                      onClick={simulateMockCheckout}
                    >
                      {mockCheckoutComplete() ? 'Mock checkout complete' : 'Simulate $2.00 checkout'}
                    </button>
                    <Show when={mockCheckoutComplete()}>
                      <div class="cinema-mock-receipt" role="status">
                        <p class="cinema-eyebrow">THE NC BANK · DEMO RECEIPT</p>
                        <p>Reference: NCB-DEMO-001 · Test amount: $2.00</p>
                        <p>Status: simulated only; no payment was requested or made.</p>
                      </div>
                    </Show>
                    <p class="cinema-preview-status" role="status">{mockCheckoutMessage()}</p>
                    <p class="cinema-mock-balance">
                      Test-only mock balance: ${mockBalance().toFixed(2)} · non-payable · not wallet funds
                    </p>
                  </section>

                  <section
                    class="cinema-preview-card cinema-vip-card"
                    classList={{'is-unlocked': mockCheckoutComplete()}}
                    aria-labelledby="mock-vip-title"
                  >
                    <h4 id="mock-vip-title">Local VIP dashboard</h4>
                    <Show when={mockCheckoutComplete()} fallback={
                      <p>Complete the simulated verification and $2.00 test checkout to preview this local dashboard.</p>
                    }>
                      <p class="cinema-vip-status">VIP preview unlocked locally. This is not an account entitlement.</p>
                      <p class="cinema-vip-code" aria-label="Decorative, non-redeemable display code">14----14----HIDDEN</p>
                    </Show>
                    <p class="cinema-preview-status" role="status">
                      {mockCheckoutComplete() ?
                        'Mock checkout receipt: $2.00 test-only and non-payable. No payment was made.' :
                        'VIP dashboard is waiting for the mock checkout.'}
                    </p>
                  </section>

                  <section class="cinema-preview-card" aria-labelledby="local-heartbeat-title">
                    <h4 id="local-heartbeat-title">Local heartbeat</h4>
                    <p>Opt-in timer only; it does not track activity, contact a server, or represent earnings.</p>
                    <button
                      class="cinema-control"
                      type="button"
                      disabled={!mockCheckoutComplete() && !heartbeatActive()}
                      aria-pressed={heartbeatActive()}
                      onClick={toggleLocalHeartbeat}
                    >
                      {heartbeatActive() ? 'Stop local heartbeat' : 'Start local heartbeat'}
                    </button>
                    <p class="cinema-preview-status" role="status">
                      {heartbeatActive() ?
                        'Local timer running; no activity or earnings are tracked.' :
                        mockCheckoutComplete() ?
                          'Local timer stopped; no activity or earnings are tracked.' :
                          'Complete the test flow to enable this local-only timer.'}
                    </p>
                    <p>Local timer ticks this session: {heartbeatTicks()}</p>
                  </section>

                </div>
              </section>

              <section class="cinema-preview-earnings" aria-labelledby="demo-earnings-title">
                <div>
                  <p class="cinema-eyebrow">NON-PAYABLE TEST COUNTER</p>
                  <h4 id="demo-earnings-title">+${demoCredits().toFixed(2)} simulated USDT</h4>
                </div>
                <span>DEMO ONLY · NOT A BALANCE</span>
              </section>
              <div class="cinema-preview-actions">
                <button class="cinema-control" type="button" onClick={() => addDemoCredit('short video ad')}>
                  Short Video Ad · simulate +$0.50
                </button>
                <button class="cinema-control cinema-control-subtle" type="button" onClick={() => addDemoCredit('direct-click ad')}>
                  Direct-Click Ad · simulate +$0.50
                </button>
              </div>
              <p class="cinema-preview-status" role="status">{demoMessage()}</p>
            </section>
          </section>
        </Show>
      </section>
    </EmbeddedBrowserEngine>
  );
}

const root = document.getElementById('cinema-root');
if(!root) throw new Error('Cinema page root element was not found.');

render(() => <CinemaPage />, root);
