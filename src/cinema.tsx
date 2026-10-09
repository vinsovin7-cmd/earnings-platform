import {onCleanup, onMount, Show, createSignal} from 'solid-js';
import {render} from 'solid-js/web';
import '@/cinema.scss';

const STREAM_URL = 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8';
const HLS_MIME_TYPE = 'application/vnd.apple.mpegurl';

type MonetagAdOptions = 'pop' | {
  type: 'inApp',
  inAppSettings: {
    frequency: number,
    capping: number,
    interval: number,
    timeout: number,
    everyPage: boolean
  }
};

declare global {
  interface Window {
    show_11896240?: (options?: MonetagAdOptions) => Promise<void> | void
  }
}

function CinemaPage() {
  const [status, setStatus] = createSignal('Loading the ad service…');
  const [adReady, setAdReady] = createSignal(false);
  const [adLoading, setAdLoading] = createSignal(false);
  const [streamUnlocked, setStreamUnlocked] = createSignal(false);
  const [streamReady, setStreamReady] = createSignal(false);
  const [streamLoading, setStreamLoading] = createSignal(false);
  const [bonusLoading, setBonusLoading] = createSignal(false);
  let video: HTMLVideoElement;
  let hls: import('hls.js').default;
  let disposed = false;
  let usesHls = false;
  let inAppInitialized = false;

  const playVideo = async() => {
    try {
      await video.play();
      setStatus('Live stream playing.');
    } catch(error) {
      if(error instanceof DOMException && error.name === 'NotAllowedError') {
        console.info('Live stream autoplay requires a user gesture.', error);
        setStatus('Playback was blocked. Use the video controls to start the live stream.');
      } else {
        console.error('Live stream playback could not start.', error);
        setStatus('Playback could not start. Use the video controls to retry.');
      }
    }
  };

  const initializeInAppAds = () => {
    if(inAppInitialized) return;
    inAppInitialized = true;

    try {
      const showAd = window.show_11896240;
      if(!showAd) {
        console.error('Monetag SDK is unavailable for In-App Interstitial.');
        return;
      }

      const result = showAd({
        type: 'inApp',
        inAppSettings: {
          frequency: 2,
          capping: 0.1,
          interval: 30,
          timeout: 5,
          everyPage: false
        }
      });
      if(result) void result.catch((error) => {
          console.error('Monetag In-App Interstitial failed.', error);
        });
    } catch(error) {
      console.error('Monetag In-App Interstitial could not be initialized.', error);
    }
  };

  const loadStream = async() => {
    setStreamReady(false);
    setStreamLoading(true);
    setStatus('Loading the live stream…');
    hls?.destroy();
    hls = undefined;
    usesHls = false;
    if(video.canPlayType(HLS_MIME_TYPE)) {
      video.src = STREAM_URL;
      video.load();
      setStreamReady(true);
      setStreamLoading(false);
      setStatus('Stream unlocked. Select Play in the video controls.');
      return;
    }

    try {
      const {default: Hls} = await import('hls.js');
      if(disposed) return;

      if(!Hls.isSupported()) {
        setStreamLoading(false);
        setStatus('This browser does not support HLS playback.');
        return;
      }

      usesHls = true;
      video.removeAttribute('src');
      hls = new Hls();
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if(!disposed) {
          setStreamReady(true);
          setStreamLoading(false);
          setStatus('Stream unlocked. Select Play in the video controls.');
        }
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if(data.fatal) {
          console.error('Live HLS stream failed.', data);
          hls?.destroy();
          hls = undefined;
          setStreamReady(false);
          setStreamLoading(false);
          setStatus('The live stream could not be loaded. Please try again later.');
        }
      });
      hls.loadSource(STREAM_URL);
      hls.attachMedia(video);
    } catch(error) {
      console.error('Could not initialize HLS playback.', error);
      setStreamLoading(false);
      setStatus('The live stream player could not be initialized.');
    }
  };

  const unlockStream = async() => {
    const showAd = window.show_11896240;
    if(!showAd) {
      setStatus('The ad service is unavailable. Please reload the page and try again.');
      return;
    }

    setAdLoading(true);
    setStatus('Please watch the ad to unlock the live stream…');
    try {
      const result = showAd();
      if(!result || typeof result.then !== 'function') {
        throw new Error('Monetag rewarded interstitial did not return a completion promise.');
      }
      await result;
      setStreamUnlocked(true);
      void loadStream();
    } catch(error) {
      console.error('Monetag rewarded interstitial failed.', error);
      setStatus('The ad could not be completed. The live stream remains locked; please try again.');
    } finally {
      setAdLoading(false);
    }
  };

  const openSponsorOffer = async() => {
    const showAd = window.show_11896240;
    if(!showAd) {
      setStatus('The ad service is unavailable. Please reload the page and try again.');
      return;
    }

    setBonusLoading(true);
    try {
      const result = showAd('pop');
      if(!result || typeof result.then !== 'function') {
        throw new Error('Monetag rewarded popup did not return a promise.');
      }
      await result;
      setStatus('The sponsor offer launch was attempted. Its completion cannot be verified here, so no bonus was credited.');
    } catch(error) {
      console.error('Monetag rewarded popup failed to open.', error);
      setStatus('The sponsor offer could not be opened. Please try again.');
    } finally {
      setBonusLoading(false);
    }
  };

  onMount(() => {
    video.volume = 0.7;
    const sdkScript = document.getElementById('monetag-sdk');
    const onSdkLoad = () => {
      if(typeof window.show_11896240 === 'function') {
        setAdReady(true);
        setStatus('Ready to unlock the live stream.');
      } else {
        console.error('Monetag SDK loaded without exposing show_11896240().');
        setStatus('The ad service could not be initialized. Please reload the page.');
      }
    };
    const onSdkError = () => {
      console.error('Monetag SDK failed to load.');
      setStatus('The ad service could not be loaded. Please reload the page.');
    };

    if(typeof window.show_11896240 === 'function') {
      setAdReady(true);
      setStatus('Ready to unlock the live stream.');
    } else {
      sdkScript?.addEventListener('load', onSdkLoad);
      sdkScript?.addEventListener('error', onSdkError);
    }

    onCleanup(() => {
      disposed = true;
      sdkScript?.removeEventListener('load', onSdkLoad);
      sdkScript?.removeEventListener('error', onSdkError);
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    });
  });

  return (
    <main class="cinema-page">
      <section class="cinema-card" aria-labelledby="cinema-title">
        <header class="cinema-header">
          <div>
            <p class="cinema-eyebrow">URBAN CINEMA</p>
            <h1 id="cinema-title">Live broadcast</h1>
          </div>
          <span class="cinema-live"><span class="cinema-live-dot" aria-hidden="true"></span> LIVE</span>
        </header>

        <div class="cinema-player">
          <video
            ref={(element) => { video = element; element.volume = 0.7; }}
            controls={streamUnlocked()}
            playsinline
            aria-label="Al Jazeera English live broadcast"
            onPlay={() => {
              setStatus('Live stream playing.');
              initializeInAppAds();
            }}
            onPause={() => {
              if(!disposed && streamReady()) setStatus('Live stream paused.');
            }}
            onError={(event) => {
              if(usesHls || disposed) return;
              console.error('Live stream failed to load.', event.currentTarget.error);
              setStreamReady(false);
              setStatus('The live stream could not be loaded. Please try again later.');
            }}
          />
        </div>

        <div class="cinema-footer">
          <p class="cinema-status" role="status" aria-live="polite" aria-atomic="true">{status()}</p>
          <button
            class="cinema-play"
            type="button"
            disabled={!adReady() || adLoading() || streamLoading()}
            aria-busy={adLoading() || streamLoading()}
            onClick={() => {
              if(!streamUnlocked()) void unlockStream();
              else if(!streamReady()) void loadStream();
              else void playVideo();
            }}
          >
            {adLoading() ? 'Loading ad…' : streamLoading() ? 'Loading stream…' :
              streamUnlocked() && !streamReady() ? 'Retry stream' :
                streamUnlocked() ? 'Play live stream' : 'Watch an ad to unlock'}
          </button>
          <button
            class="cinema-bonus"
            type="button"
            disabled={!adReady() || bonusLoading() || adLoading()}
            onClick={() => { void openSponsorOffer(); }}
          >
            {bonusLoading() ? 'Opening offer…' : 'Explore sponsor offer'}
          </button>
          <span class="cinema-volume">START VOLUME <strong>70%</strong></span>
          <p class="cinema-reward-note">
            Sponsor offers open an advertiser page; this page cannot verify offer completion or credit bonuses. Timed interstitials may briefly cover the player.
          </p>
        </div>
      </section>
    </main>
  );
}

const root = document.getElementById('cinema-root');
if(!root) {
  throw new Error('Cinema page root element was not found.');
}

render(() => <CinemaPage />, root);
