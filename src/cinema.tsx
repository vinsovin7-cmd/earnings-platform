import {onCleanup, onMount, Show, createSignal, For, Switch, Match, createEffect} from 'solid-js';
import {render} from 'solid-js/web';
import EmbeddedBrowserEngine, {CinemaSection} from '@components/EmbeddedBrowserEngine';
import {getNextPlayableIndex} from '@/cinemaQueue';
import {getPlaybackStorageKey, parsePlaybackPosition} from '@/cinemaPlayback';
import {
  CinemaItem, 
  DEMO_CINEMA_ITEM, 
  FULL_CINEMA_CATALOG,
  getCatalogFailureResult, 
  getCatalogResponseResult, 
  getDemoRetryIndex, 
  getInitialCatalog,
  getNextItemInQueue,
  shouldAutoLoadInitialCatalog, 
  shouldRetryCatalogAutomatically, 
  HLS_MIME_TYPE,
  MERLIN_SEASON_1
} from '@/cinemaCatalog';
import GeminiCodingAssistant from '@components/GeminiCodingAssistant';
import {fetchTonUsdtBalance, formatTonUsdtBalance} from '@/tonUsdt';
import {GeminiCompanionSession, CompanionMessage, CompanionSessionState} from './GeminiCompanionSession';
import {CinemaMonetizationManager, createCinemaMonetizationManager, WithdrawalRequest, formatUsdtAmount, EarningsEvent} from '@/cinemaMonetization';
import '@/cinema.scss';

const LIVE_STREAM_URL = 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8';
const AJE_URL = 'https://www.aljazeera.com/live';
// Fallback YouTube live stream for Al Jazeera English
const YOUTUBE_AJE_URL = 'https://www.youtube.com/embed/0QJ42Y92s3E?autoplay=1&mute=1';
// Direct Al Jazeera HLS alternative
const AJE_HLS_FALLBACK = 'https://aljazeera-eng-hls-live.adaptive.level3.net/ajlive/aljazeera_english_720p/index.m3u8';
// YouTube embed for cinema fallback
const YOUTUBE_EMBED_BASE = 'https://www.youtube.com/embed/';

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
  const [browserOnline, setBrowserOnline] = createSignal(navigator.onLine);
  const [catalogEndpointStatus, setCatalogEndpointStatus] = createSignal('No catalog request completed yet.');
  const [loading, setLoading] = createSignal(false);
  const [playing, setPlaying] = createSignal(false);
  const [playbackBlocked, setPlaybackBlocked] = createSignal(false);
  const [geminiKey, setGeminiKey] = createSignal('');
  const [geminiKeySaved, setGeminiKeySaved] = createSignal(false);
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
  // Companion session state
  const [companionSection, setCompanionSection] = createSignal(false);
  const [companionMessages, setCompanionMessages] = createSignal<CompanionMessage[]>([]);
  const [companionState, setCompanionState] = createSignal<CompanionSessionState>('idle');
  const [companionInput, setCompanionInput] = createSignal('');
  const [companionVisible, setCompanionVisible] = createSignal(false);
  const [companionMinimized, setCompanionMinimized] = createSignal(false);
  const [companionSessionActive, setCompanionSessionActive] = createSignal(false);
  // Monetization state
  const [totalEarnings, setTotalEarnings] = createSignal(0);
  const [earningsDisplay, setEarningsDisplay] = createSignal('');
  const [pendingWithdrawals, setPendingWithdrawals] = createSignal<WithdrawalRequest[]>([]);
  const [withdrawalAmount, setWithdrawalAmount] = createSignal('');
  const [withdrawalStatus, setWithdrawalStatus] = createSignal('');
  const [withdrawalError, setWithdrawalError] = createSignal('');
  const [withdrawalHistory, setWithdrawalHistory] = createSignal<WithdrawalRequest[]>([]);
  const [monetizationReady, setMonetizationReady] = createSignal(false);
  let video: HTMLVideoElement;
  let hls: import('hls.js').default;
  let tonConnectUi: import('@tonconnect/ui').TonConnectUI;
  let unsubscribeWalletStatus: (() => void) | undefined;
  let disposed = false;
  let playbackGeneration = 0;
  let watchTimeInterval: number | undefined;
  let companionSession: GeminiCompanionSession | null = null;
  let companionDispose: (() => void) | null = null;
  let companionContainer: HTMLDivElement | undefined;
  let monetizationManager: CinemaMonetizationManager;
  let catalogRequest: AbortController;
  let catalogTimeout: number;
  let catalogAutoRetryTimeout: number;
  let catalogAutoRetryPending = false;
  let catalogAutoRetryUsed = false;
  let initialCatalogSelectionPending = true;
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

  const clearCatalogAutoRetry = () => {
    window.clearTimeout(catalogAutoRetryTimeout);
    catalogAutoRetryTimeout = undefined;
    catalogAutoRetryPending = false;
  };

  const runCatalogAutoRetry = () => {
    if(!catalogAutoRetryPending || disposed || document.visibilityState === 'hidden' || catalogRequest) return;
    window.clearTimeout(catalogAutoRetryTimeout);
    catalogAutoRetryTimeout = undefined;
    catalogAutoRetryPending = false;
    void loadCatalog(true);
  };

  const scheduleCatalogAutoRetry = () => {
    if(catalogAutoRetryUsed || disposed) return;
    catalogAutoRetryUsed = true;
    catalogAutoRetryPending = true;
    catalogAutoRetryTimeout = window.setTimeout(runCatalogAutoRetry, 2_500);
  };

  const onBrowserOnline = () => {
    setBrowserOnline(true);
    runCatalogAutoRetry();
  };

  const onBrowserOffline = () => setBrowserOnline(false);

  const onDocumentVisibilityChange = () => {
    if(document.visibilityState === 'hidden') savePlaybackPosition();
    else runCatalogAutoRetry();
  };

  const setCatalogRequestOutcome = (outcome: string) => {
    setCatalogEndpointStatus(`${outcome} · ${new Date().toLocaleTimeString()}`);
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
      setWasPlayingBeforeHide(false);
      void video.play().catch((error) => {
        console.warn('Could not resume playback after restoring the mini-player.', error);
      });
    }
  };

  const saveDemoKeys = (event?: SubmitEvent) => {
    event?.preventDefault();
    try {
      localStorage.setItem(DEMO_KEYS_STORAGE_KEY, JSON.stringify({
        gemini: geminiKey().trim(),
        srey: sreyKey().trim()
      }));
      setKeysSaved(Boolean(geminiKey().trim() || sreyKey().trim()));
      setGeminiKeySaved(Boolean(geminiKey().trim()));
      setKeySettingsMessage('Saved in this browser. Gemini receives the key only when you send a chat message.');
    } catch(error) {
      console.error('Could not save preview API keys.', error);
      setKeySettingsMessage('Could not save settings in this browser.');
    }
  };

  const removeGeminiKey = () => {
    try {
      const remainingSreyKey = sreyKey().trim();
      if(remainingSreyKey) {
        localStorage.setItem(DEMO_KEYS_STORAGE_KEY, JSON.stringify({srey: remainingSreyKey}));
      } else {
        localStorage.removeItem(DEMO_KEYS_STORAGE_KEY);
      }
      setGeminiKey('');
      setGeminiKeySaved(false);
      setKeysSaved(Boolean(remainingSreyKey));
      setKeySettingsMessage('The saved Gemini key was removed from this browser.');
    } catch(error) {
      console.error('Could not remove the saved Gemini API key.', error);
      setKeySettingsMessage('Could not remove the Gemini key from this browser.');
    }
  };

  const clearDemoKeys = () => {
    try {
      localStorage.removeItem(DEMO_KEYS_STORAGE_KEY);
      setGeminiKey('');
      setSreyKey('');
      setGeminiKeySaved(false);
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

  // Companion session handlers
  const initializeCompanionSession = () => {
    if(companionSession || !geminiKey().trim()) return;
    
    companionSession = new GeminiCompanionSession(geminiKey(), {
      maxTurns: 8,
      timeoutMs: 180_000 // 3 minutes
    });
    
    companionSession.setCallbacks({
      onMessage: (message) => {
        setCompanionMessages((prev) => [...prev, message]);
        setCompanionState(message.state || companionState());
        if(message.role === 'model') {
          setCompanionSessionActive(true);
        }
      },
      onStateChange: (state) => {
        setCompanionState(state);
        if(state === 'complete' || state === 'idle') {
          setCompanionSessionActive(false);
        }
      },
      onComplete: () => {
        setCompanionSessionActive(false);
        // Auto-hide companion after a few seconds
        setTimeout(() => {
          if(!disposed) setCompanionVisible(false);
        }, 3000);
      },
      onError: (error) => {
        console.error('Companion session error:', error);
        setDemoMessage(`Companion error: ${error.message}`);
      }
    });
  };

  const startCompanionCheckIn = () => {
    if(!companionSession || !geminiKey().trim()) {
      setDemoMessage('Add a valid Google Gemini API key to enable companion check-ins.');
      return;
    }
    
    if(companionSession.isActive()) return;
    
    setCompanionVisible(true);
    setCompanionMinimized(false);
    setCompanionSessionActive(true);
    setCompanionMessages([]);
    void companionSession.startSession();
  };

  const handleCompanionUserMessage = (event: SubmitEvent) => {
    event.preventDefault();
    const text = companionInput().trim();
    if(!text || !companionSession) return;
    
    void companionSession.handleUserMessage(text);
    setCompanionInput('');
  };

  const toggleCompanionVisibility = () => {
    setCompanionVisible(!companionVisible());
    if(!companionVisible()) {
      setCompanionMinimized(false);
    }
  };

  const minimizeCompanion = () => {
    setCompanionMinimized(true);
  };

  const restoreCompanion = () => {
    setCompanionMinimized(false);
  };

  const endCompanionSession = () => {
    if(companionSession) {
      companionSession.dispose();
      companionSession = null;
    }
    setCompanionVisible(false);
    setCompanionSessionActive(false);
    setCompanionMessages([]);
    setCompanionState('idle');
  };

  // Monetization handlers
  const requestWithdrawal = async() => {
    const amount = parseFloat(withdrawalAmount());
    if(isNaN(amount) || amount <= 0) {
      setWithdrawalError('Please enter a valid amount.');
      return;
    }
    
    if(!tonWalletAddress()) {
      setWithdrawalError('Please connect your TON wallet first.');
      return;
    }
    
    if(!monetizationManager) {
      setWithdrawalError('Monetization is not ready.');
      return;
    }
    
    if(!monetizationManager.canWithdraw()) {
      setWithdrawalError(`Minimum withdrawal is ${monetizationManager.getMinWithdrawal()} USDT.`);
      return;
    }
    
    try {
      setWithdrawalStatus('Processing withdrawal request...');
      setWithdrawalError('');
      const request = await monetizationManager.requestWithdrawal(tonWalletAddress(), amount);
      setWithdrawalAmount('');
    } catch(error) {
      setWithdrawalError(error instanceof Error ? error.message : 'Withdrawal failed.');
      setWithdrawalStatus('');
    }
  };

  const recordWatchTime = (minutes: number) => {
    if(monetizationManager) {
      if(section() === 'live') {
        monetizationManager.recordLiveWatchTime(minutes);
      } else {
        monetizationManager.recordWatchTime(minutes);
      }
    }
  };

  const startWatchTimeTracking = () => {
    if(watchTimeInterval || !monetizationManager) return;
    
    let lastRecordTime = Date.now();
    watchTimeInterval = window.setInterval(() => {
      if(disposed || !video || video.paused) return;
      
      const now = Date.now();
      const elapsedMinutes = (now - lastRecordTime) / (1000 * 60);
      
      if(elapsedMinutes >= 1) {
        const minutes = Math.floor(elapsedMinutes);
        recordWatchTime(minutes);
        lastRecordTime = now;
      }
    }, 10_000); // Check every 10 seconds
  };

  const stopWatchTimeTracking = () => {
    if(watchTimeInterval) {
      window.clearInterval(watchTimeInterval);
      watchTimeInterval = undefined;
    }
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
    // Use the full Merlin + Legend of the Seeker catalog instead of placeholder
    const fullCatalog = getInitialCatalog();
    setItems(fullCatalog);
    setStatus(`${fullCatalog.length} series ready: Merlin Seasons 1-5 & Legend of the Seeker Seasons 1-2.`);
    if(section() === 'cinema') void loadItem(0);
  };

  const retryDemoPlayback = () => {
    const retryIndex = getDemoRetryIndex(fallbackActive(), fallbackError(), currentIndex());
    if(retryIndex < 0) return;
    initialCatalogSelectionPending = false;
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
    setPlaybackBlocked(false);
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
    } catch(error) {
      if(disposed || generation !== playbackGeneration) return;
      if(error instanceof DOMException && error.name === 'NotAllowedError') {
        setPlaying(false);
        setPlaybackBlocked(true);
        setStatus('Playback needs your permission. Select Play to continue.');
      } else {
        console.error('Cinema playback could not start.', error);
        setPlaying(false);
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
    setPlaybackBlocked(false);
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
    setStatus('Loading Al Jazeera English live stream…');
    setMiniPlayer(false);
    setMiniPlayerHidden(false);
    destroyHls();
    video.pause();
    video.removeAttribute('src');
    
    // Try HLS first with shorter timeout, fall back to YouTube
    playbackTimeout = window.setTimeout(() => {
      if(disposed || generation !== playbackGeneration) return;
      ++playbackGeneration;
      clearPlaybackTimeout();
      setLoading(false);
      setFallbackError(true);
      setStatus('Using YouTube embed for Al Jazeera English');
    }, 8_000);

    try {
      const {default: Hls} = await import('hls.js');
      if(disposed || generation !== playbackGeneration) return;
      if(!Hls.isSupported()) {
        clearPlaybackTimeout();
        setLoading(false);
        setFallbackError(true);
        setStatus('Using YouTube embed for Al Jazeera English');
        return;
      }

      hls = new Hls();
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if(disposed || generation !== playbackGeneration) return;
        clearPlaybackTimeout();
        setLoading(false);
        setStatus('Al Jazeera English live stream ready');
        void playCurrent(generation);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if(data.fatal && !disposed && generation === playbackGeneration) {
          console.error('Al Jazeera English live stream failed, falling back to YouTube.', data);
          ++playbackGeneration;
          clearPlaybackTimeout();
          destroyHls();
          setLoading(false);
          setFallbackError(true);
          setStatus('Using YouTube embed for Al Jazeera English');
        }
      });
      hls.loadSource(LIVE_STREAM_URL);
      hls.attachMedia(video);
    } catch(error) {
      if(disposed || generation !== playbackGeneration) return;
      clearPlaybackTimeout();
      console.error('Could not initialize HLS, falling back to YouTube.', error);
      setLoading(false);
      setFallbackError(true);
      setStatus('Using YouTube embed for Al Jazeera English');
    }
  };

  const loadCatalog = async(isAutomaticRetry = false) => {
    if(!isAutomaticRetry) clearCatalogAutoRetry();
    catalogRequest?.abort();
    const request = new AbortController();
    catalogRequest = request;
    let timedOut = false;
    let responseStatus: number | undefined;
    const requestTimeout = window.setTimeout(() => {
      timedOut = true;
      request.abort();
    }, 12_000);
    setCatalogEndpointStatus('Catalog request in progress; no response yet.');

    try {
      const response = await fetch('/api/cinema-catalog', {
        headers: {Accept: 'application/json'},
        signal: request.signal
      });
      responseStatus = response.status;
      if(!response.ok) {
        setCatalogRequestOutcome(`HTTP ${response.status} response; catalog unavailable`);
        if(response.status !== 503) console.error('Cinema catalog request failed.', response.status);
        activateDemoFallback();
        return;
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch{
        setCatalogRequestOutcome(`HTTP ${response.status} response; invalid JSON`);
        console.error('Cinema catalog response is not valid JSON.');
        activateDemoFallback();
        return;
      }
      const result = getCatalogResponseResult(true, payload);
      if(result.kind === 'fallback') {
        setCatalogRequestOutcome(`HTTP ${response.status} response; invalid catalog data`);
        console.error('Cinema catalog response has an invalid schema.');
        activateDemoFallback();
        return;
      }

      const wasFallback = fallbackActive() || items().some((item) => item.id === DEMO_CINEMA_ITEM.id);
      setCatalogRequestOutcome(`HTTP ${response.status} response; ${result.items.length ?
        `${result.items.length} catalog titles` : 'valid empty catalog'}`);
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
        if(result.items.length && !isAutomaticRetry) {
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
          setPlaybackBlocked(false);
        }
        return;
      }

      if(shouldAutoLoadInitialCatalog(
        initialCatalogSelectionPending,
        section(),
        currentIndex(),
        result.items.length
      )) {
        initialCatalogSelectionPending = false;
        unavailableItems.clear();
        video.muted = true;
        void loadItem(0);
      }
    } catch(error) {
      const result = getCatalogFailureResult(request.signal.aborted, timedOut);
      if(result.kind === 'aborted') return;
      const failure = timedOut ? 'timeout' : 'network';
      setCatalogRequestOutcome(timedOut ? 'No HTTP response; catalog request timed out' : 'No HTTP response; network request failed');
      console.error('Cinema catalog could not be loaded.', error);
      if(shouldRetryCatalogAutomatically(isAutomaticRetry ? 1 : 0, failure)) scheduleCatalogAutoRetry();
      activateDemoFallback();
    } finally {
      window.clearTimeout(requestTimeout);
      if(catalogRequest === request) catalogRequest = undefined;
    }
  };

  const advanceQueue = () => {
    initialCatalogSelectionPending = false;
    const nextIndex = getNextPlayableIndex(currentIndex(), items().length, unavailableItems);
    if(nextIndex < 0) {
      setPlaying(false);
      setStatus('No playable titles remain in the configured catalog.');
      return;
    }
    void loadItem(nextIndex);
  };

  const selectItem = (index: number) => {
    initialCatalogSelectionPending = false;
    unavailableItems.clear();
    void loadItem(index);
  };

  const selectSection = (nextSection: CinemaSection) => {
    if(nextSection !== 'cinema') initialCatalogSelectionPending = false;
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
    if(nextSection === 'rewards') {
      setSection('rewards');
      if(video.currentSrc || video.src) {
        setMiniPlayer(true);
        setMiniPlayerHidden(false);
      }
      setStatus('Earnings are unavailable until a verified rewards service is configured.');
      return;
    }
    if(nextSection === 'companion') {
      setSection('companion');
      setCompanionVisible(true);
      if(video.currentSrc || video.src) {
        setMiniPlayer(true);
        setMiniPlayerHidden(false);
      }
      return;
    }
  };

  onMount(() => {
    manifestOrigin = window.location.origin;
    const webApp = (window as Window & {
      Telegram?: {
        WebApp?: {
          ready: () => void,
          expand: () => void,
          initData: string,
          initDataUnsafe: {
            user?: {
              id: number,
              first_name?: string,
              last_name?: string,
              username?: string
            },
            chat?: {
              id: number,
              type: string
            },
            hash: string
          },
          themeParams: {
            bg_color?: string,
            text_color?: string,
            hint_color?: string,
            link_color?: string,
            button_color?: string,
            button_text_color?: string,
            secondary_bg_color?: string
          },
          isExpanded: boolean
        }
      }
    }).Telegram?.WebApp;

    if(webApp) {
      webApp.ready();
      webApp.expand();

      const user = webApp.initDataUnsafe?.user;
      if(user) {
        const displayName = user.first_name || 'User';
        const fullName = user.last_name ? `${displayName} ${user.last_name}` : displayName;
        setTelegramContext(`Telegram · ${fullName}${user.username ? ` @${user.username}` : ''}`);
      } else {
        setTelegramContext('Telegram WebApp');
      }

      const applyTelegramTheme = () => {
        const root = document.documentElement;
        const theme = webApp.themeParams;
        if(theme.bg_color) {
          root.style.setProperty('--tg-theme-bg-color', theme.bg_color);
          root.style.setProperty('--tg-theme-secondary-bg-color', theme.secondary_bg_color || theme.bg_color);
        }
        if(theme.text_color) {
          root.style.setProperty('--tg-theme-text-color', theme.text_color);
        }
        if(theme.hint_color) {
          root.style.setProperty('--tg-theme-hint-color', theme.hint_color);
        }
        if(theme.link_color) {
          root.style.setProperty('--tg-theme-link-color', theme.link_color);
        }
        if(theme.button_color) {
          root.style.setProperty('--tg-theme-button-color', theme.button_color);
        }
        if(theme.button_text_color) {
          root.style.setProperty('--tg-theme-button-text-color', theme.button_text_color);
        }
      };

      applyTelegramTheme();

      const themeObserver = new MutationObserver(() => {
        applyTelegramTheme();
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-tgme-w']
      });

      onCleanup(() => themeObserver.disconnect());
    } else {
      setTelegramContext('WEB APP');
    }
    // Initialize monetization manager
    monetizationManager = createCinemaMonetizationManager();
    monetizationManager.setupTracking(video);
    monetizationManager.onEarningsUpdate((amount) => {
      setTotalEarnings(amount);
      setEarningsDisplay(formatUsdtAmount(amount));
    });
    monetizationManager.onWithdrawalStatus((request) => {
      if(request.status === 'pending' || request.status === 'processing') {
        setPendingWithdrawals(prev => [...prev, request]);
      } else if(request.status === 'completed' || request.status === 'failed') {
        setPendingWithdrawals(prev => prev.filter(r => r !== request));
        setWithdrawalHistory(prev => [...prev, request]);
      }
      if(request.status === 'completed') {
        setWithdrawalStatus(`Withdrawal completed! TX: ${request.txHash?.slice(0, 16)}...`);
        setWithdrawalError('');
      } else if(request.status === 'failed') {
        setWithdrawalError(`Withdrawal failed: ${request.error || 'Unknown error'}`);
        setWithdrawalStatus('');
      }
    });
    setMonetizationReady(true);
    
    void initializeTonConnect();
    try {
      const savedKeys: unknown = JSON.parse(localStorage.getItem(DEMO_KEYS_STORAGE_KEY) || '{}');
      if(savedKeys && typeof savedKeys === 'object') {
        const keys = savedKeys as Record<string, unknown>;
        if(typeof keys.gemini === 'string') setGeminiKey(keys.gemini);
        if(typeof keys.srey === 'string') setSreyKey(keys.srey);
        setGeminiKeySaved(typeof keys.gemini === 'string' && Boolean(keys.gemini));
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
    
    // Initialize with full Merlin + Legend of the Seeker catalog immediately
    // Don't wait for API - this is the primary content
    const fullCatalog = getInitialCatalog();
    setItems(fullCatalog);
    setCatalogReady(true);
    setStatus(`${fullCatalog.length} series ready: Merlin Seasons 1-5 & Legend of the Seeker Seasons 1-2.`);
    
    // Still try to load from API for any additional content
    void loadCatalog();
    
    // Initialize companion session
    initializeCompanionSession();
    
    // Companion visibility/focus trigger
    const handleCompanionTrigger = () => {
      if(document.visibilityState === 'visible' && geminiKey().trim()) {
        // Check if we should trigger companion check-in
        // Only trigger if user has been away and returns
        // We'll use a simple approach: trigger on first visibility change after being hidden
        if(companionState() === 'idle' && !companionSessionActive()) {
          startCompanionCheckIn();
        }
      }
    };
    
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('online', onBrowserOnline);
    window.addEventListener('offline', onBrowserOffline);
    window.addEventListener('pagehide', savePlaybackPosition);
    document.addEventListener('visibilitychange', onDocumentVisibilityChange);
    document.addEventListener('visibilitychange', handleCompanionTrigger);
    window.addEventListener('focus', handleCompanionTrigger);

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
      window.removeEventListener('online', onBrowserOnline);
      window.removeEventListener('offline', onBrowserOffline);
      window.removeEventListener('pagehide', savePlaybackPosition);
      document.removeEventListener('visibilitychange', onDocumentVisibilityChange);
      document.removeEventListener('visibilitychange', handleCompanionTrigger);
      window.removeEventListener('focus', handleCompanionTrigger);
      window.clearTimeout(catalogAutoRetryTimeout);
      catalogAutoRetryPending = false;
      balanceRequest?.abort();
      balanceRequest = undefined;
      window.clearInterval(balanceRefreshInterval);
      window.clearInterval(heartbeatInterval);
      unsubscribeWalletStatus?.();
      // Clean up watch time tracking
      stopWatchTimeTracking();
      // Clean up monetization
      if(monetizationManager) {
        monetizationManager.dispose();
        monetizationManager = undefined;
      }
      // Clean up companion session
      if(companionDispose) {
        companionDispose();
        companionDispose = null;
      }
      if(companionSession) {
        companionSession.dispose();
        companionSession = null;
      }
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
        <Show when={monetizationReady() && section() !== 'companion'}>
          <div class="cinema-monetization-header">
            <span class="cinema-earnings-badge" aria-live="polite">
              Earnings: {earningsDisplay() || '$0.00 USDT'}
            </span>
            <Show when={totalEarnings() >= 1}>
              <button
                class="cinema-withdraw-button"
                type="button"
                aria-label="Withdraw earnings"
                onClick={() => {
                  setSection('rewards');
                  window.history.pushState({}, '', '#rewards');
                }}
              >
                Withdraw
              </button>
            </Show>
          </div>
        </Show>
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
            <Match when={section() === 'companion'}>
              <div>
                <p class="cinema-eyebrow">FRIENDLY CHECK-IN</p>
                <h1>Companion</h1>
                <p class="cinema-intro">A warm, caring friend checking in on your well-being.</p>
              </div>
              <span class="cinema-companion-status">{companionSessionActive() ? 'Active' : 'Ready'}</span>
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
                onPlaying={() => {
                  setPlaying(true);
                  setPlaybackBlocked(false);
                  setStatus('Now playing.');
                }}
                onPause={() => {
                  setPlaying(false);
                  if(status() === 'Now playing.') setStatus('Playback paused.');
                }}
                onTimeUpdate={savePlaybackPosition}
                onLoadedMetadata={() => {
                  if(section() === 'cinema') restorePlaybackPosition();
                }}
                onLoadedData={() => {
                  clearPlaybackTimeout();
                  setLoading(false);
                  if(section() === 'cinema' && !playing() && !playbackBlocked()) {
                    setStatus(`Ready: ${items()[currentIndex()]?.title || 'your title'}.`);
                  }
                }}
                onEnded={() => {
                  savePlaybackPosition();
                  stopWatchTimeTracking();
                  if(section() === 'cinema') advanceQueue();
                }}
                onPlay={() => {
                  startWatchTimeTracking();
                }}
                onPause={() => {
                  stopWatchTimeTracking();
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
              
              {/* YouTube Embed for Al Jazeera Live Stream - Falls back when HLS fails */}
              <Show when={section() === 'live' && fallbackError()}>
                <div class="cinema-youtube-fallback">
                  <iframe
                    width="100%"
                    height="100%"
                    src={YOUTUBE_AJE_URL}
                    title="Al Jazeera English Live Stream"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              </Show>
              
              <Show when={loading()}>
                <div class="cinema-loading" role="status">
                  {section() === 'live' ? 'Connecting to the official live feed…' : 'Preparing your stream…'}
                </div>
              </Show>
              <Show when={section() === 'cinema' && !items().length}>
                <div class="cinema-player-empty">
                  <span class="cinema-empty-mark" aria-hidden="true">U</span>
                  <strong>Your next story starts here</strong>
                  <span>Merlin Seasons 1-5 & Legend of the Seeker Seasons 1-2</span>
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
                    <div class="cinema-network-status" aria-label="Connection advisory">
                      <span>Browser connectivity: {browserOnline() ? 'online' : 'offline'} (advisory)</span>
                      <span>Catalog endpoint: {catalogEndpointStatus()}</span>
                    </div>
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
                  <div>Merlin <span>Seasons 1–5</span></div>
                  <div>Legend of the Seeker <span>Seasons 1–2</span></div>
                  <small>Available now: 7 complete series</small>
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

        <Show when={section() === 'cinema'}>
          <GeminiCodingAssistant
            apiKey={geminiKey()}
            keySaved={geminiKeySaved()}
            keyStatus={keySettingsMessage()}
            onApiKeyInput={(value) => {
              setGeminiKey(value);
              setGeminiKeySaved(false);
              setKeysSaved(Boolean(sreyKey().trim()));
              setKeySettingsMessage('');
            }}
            onSaveKey={() => saveDemoKeys()}
            onRemoveKey={removeGeminiKey}
          />
        </Show>

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
            <Show when={monetizationReady()} fallback={
              <>
                <span class="cinema-rewards-icon" aria-hidden="true">◇</span>
                <h2 id="rewards-title">Verified earnings are not available yet</h2>
                <p>Viewing time stored in this browser is not proof of a completed task, and it cannot authorize a blockchain payout. A verified account, persistent rewards ledger and payout service must be configured before earnings can be enabled.</p>
                <a href="https://ton.org/wallets" target="_blank" rel="noopener noreferrer">Explore TON wallets <span aria-hidden="true">↗</span></a>
              </>
            }>
              <span class="cinema-rewards-icon" aria-hidden="true">◇</span>
              <h2 id="rewards-title">Your Earnings</h2>
              <div class="cinema-earnings-display">
                <p class="cinema-earnings-total">Total: <strong>{earningsDisplay() || '$0.00 USDT'}</strong></p>
                <p class="cinema-earnings-note">Earned from watching cinema and live streams</p>
              </div>
              
              <Show when={tonWalletAddress() && tonWalletOnMainnet()}>
                <section class="cinema-withdrawal-section" aria-labelledby="withdrawal-title">
                  <div class="cinema-withdrawal-heading">
                    <p class="cinema-eyebrow">TON WITHDRAWAL</p>
                    <h3 id="withdrawal-title">Withdraw to Your Wallet</h3>
                  </div>
                  <p>Withdraw your accumulated USDT earnings directly to your connected TON wallet.</p>
                  <p>Minimum withdrawal: $1.00 USDT | Fee: $0.10 USDT flat</p>
                  
                  <form class="cinema-withdrawal-form" onSubmit={(e) => {
                    e.preventDefault();
                    void requestWithdrawal();
                  }}>
                    <label>
                      Withdrawal Amount (USDT)
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max={totalEarnings()}
                        value={withdrawalAmount()}
                        disabled={!monetizationManager?.canWithdraw()}
                        onInput={(event) => setWithdrawalAmount(event.currentTarget.value)}
                        placeholder={`Min: $1.00, Available: $${totalEarnings().toFixed(2)}`}
                      />
                    </label>
                    <button
                      class="cinema-control"
                      type="submit"
                      disabled={!monetizationManager?.canWithdraw() || !withdrawalAmount() || parseFloat(withdrawalAmount()) < 1}
                    >
                      Request Withdrawal
                    </button>
                  </form>
                  <Show when={withdrawalStatus()}>
                    <p class="cinema-withdrawal-status" role="status">{withdrawalStatus()}</p>
                  </Show>
                  <Show when={withdrawalError()}>
                    <p class="cinema-withdrawal-error" role="alert">{withdrawalError()}</p>
                  </Show>
                </section>
                
                <section class="cinema-transaction-history" aria-labelledby="history-title">
                  <h4 id="history-title">Transaction History</h4>
                  <Show when={withdrawalHistory().length > 0} fallback={
                    <p>No withdrawals yet. Start watching to earn!</p>
                  }>
                    <ul class="cinema-transaction-list">
                      <For each={withdrawalHistory()}>
                        {(request) => (
                          <li class={`cinema-transaction-item ${request.status}`}>
                            <div>
                              <strong>${request.amount.toFixed(2)} USDT</strong>
                              <span>to {request.targetAddress.slice(0, 10)}...</span>
                            </div>
                            <div>
                              <span class={`cinema-transaction-status ${request.status}`}>
                                {request.status.toUpperCase()}
                              </span>
                              <Show when={request.txHash}>
                                <small>TX: {request.txHash.slice(0, 16)}...</small>
                              </Show>
                              <small>{new Date(request.timestamp).toLocaleString()}</small>
                            </div>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </section>
                
                <p class="cinema-rewards-note">
                  <strong>Note:</strong> This is a local earnings tracker. In production, earnings would be verified server-side and withdrawals would be processed through a smart contract on the TON blockchain.
                </p>
              </Show>
              
              <Show when={!tonWalletAddress() || !tonWalletOnMainnet()}>
                <p class="cinema-rewards-warning">
                  Connect your TON wallet (mainnet) to enable withdrawals.
                </p>
                <button class="cinema-control" type="button" onClick={() => void connectTonWallet()}>
                  Connect TON Wallet
                </button>
              </Show>
              
              <a href="https://ton.org/wallets" target="_blank" rel="noopener noreferrer">
                Explore TON wallets <span aria-hidden="true">↗</span>
              </a>
            </Show>
            
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
                <p>The Gemini key is saved in plain browser localStorage and sent directly to Google only when you use the Cinema coding assistant. The Srey key remains local and is not connected to a provider.</p>
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
                    'Preview settings are saved locally.' :
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
      
      {/* Companion Check-in Overlay */}
      <Show when={companionVisible() && !companionMinimized()}>
        <section
          class="cinema-companion-overlay"
          aria-label="Companion check-in"
          ref={companionContainer}
        >
          <div class="cinema-companion-header">
            <h2>Friend Check-In</h2>
            <button
              class="cinema-companion-minimize"
              type="button"
              aria-label="Minimize companion"
              onClick={minimizeCompanion}
            >
              −
            </button>
          </div>
          <div class="cinema-companion-messages" aria-live="polite">
            <For each={companionMessages()}>
              {(message) => (
                <div
                  class={`cinema-companion-message ${message.role}`}
                  classList={{
                    'cinema-companion-message-user': message.role === 'user',
                    'cinema-companion-message-companion': message.role === 'model'
                  }}
                >
                  <strong>{message.role === 'user' ? 'You' : 'Friend'}</strong>
                  <p>{message.text}</p>
                  <span class="cinema-companion-timestamp">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </For>
            <Show when={companionMessages().length === 0 && !companionSessionActive()}>
              <p class="cinema-companion-welcome">
                A warm, caring friend would like to check in on you. 
                This is a 1-3 minute conversation about your well-being.
              </p>
            </Show>
          </div>
          <Show when={companionState() !== 'goodbye' && companionState() !== 'complete'}>
            <form class="cinema-companion-form" onSubmit={handleCompanionUserMessage}>
              <label for="companion-input">Your response</label>
              <input
                id="companion-input"
                type="text"
                value={companionInput()}
                disabled={!companionSessionActive()}
                onInput={(event) => { setCompanionInput(event.currentTarget.value); }}
                placeholder="Type your response..."
                autoComplete="off"
              />
              <button
                class="cinema-control"
                type="submit"
                disabled={!companionInput().trim() || !companionSessionActive()}
              >
                Send
              </button>
            </form>
          </Show>
          <div class="cinema-companion-footer">
            <button
              class="cinema-control cinema-control-subtle"
              type="button"
              onClick={endCompanionSession}
            >
              End Check-In
            </button>
            <span class="cinema-companion-state">
              {companionSessionActive() ? 'Active' : 'Waiting'}
            </span>
          </div>
        </section>
      </Show>
      
      {/* Companion Minimized Indicator */}
      <Show when={companionVisible() && companionMinimized()}>
        <button
          class="cinema-companion-indicator"
          type="button"
          aria-label="Restore companion check-in"
          onClick={restoreCompanion}
          title="Friend check-in is minimized"
        >
          <span aria-hidden="true">💬</span>
          <span class="cinema-companion-badge">1</span>
        </button>
      </Show>
      
      {/* Quick Access Button for Companion */}
      <Show when={geminiKey().trim() && !companionVisible()}>
        <button
          class="cinema-floating-companion"
          type="button"
          aria-label="Start friend check-in"
          onClick={startCompanionCheckIn}
          title="Start a friendly check-in"
        >
          <span aria-hidden="true">💬</span>
        </button>
      </Show>
    </EmbeddedBrowserEngine>
  );
}

const root = document.getElementById('cinema-root');
if(!root) throw new Error('Cinema page root element was not found.');

render(() => <CinemaPage />, root);
