import {onCleanup, onMount, Show, createSignal, For, Switch, Match} from 'solid-js';
import {render} from 'solid-js/web';
import EmbeddedBrowserEngine, {CinemaSection} from '@components/EmbeddedBrowserEngine';
import '@/cinema.scss';

const LIVE_STREAM_URL = 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8';
const HLS_MIME_TYPE = 'application/vnd.apple.mpegurl';
const AJE_URL = 'https://www.aljazeera.com/live';

type CinemaItem = {
  id: string,
  title: string,
  series: string,
  season: number,
  episode: number,
  src: string,
  type: string
};

function isCinemaItem(value: unknown): value is CinemaItem {
  if(!value || typeof value !== 'object' || !('id' in value) || !('title' in value) ||
    !('series' in value) || !('season' in value) || !('episode' in value) ||
    !('src' in value) || !('type' in value)) {
    return false;
  }

  if(typeof value.id !== 'string' || typeof value.title !== 'string' ||
    typeof value.series !== 'string' || !Number.isInteger(value.season) ||
    !Number.isInteger(value.episode) || typeof value.src !== 'string' ||
    (value.type !== HLS_MIME_TYPE && value.type !== 'video/mp4')) {
    return false;
  }

  try {
    return new URL(value.src).protocol === 'https:';
  } catch{
    return false;
  }
}

function CinemaPage() {
  const [section, setSection] = createSignal<CinemaSection>('cinema');
  const [items, setItems] = createSignal<CinemaItem[]>([]);
  const [currentIndex, setCurrentIndex] = createSignal(-1);
  const [status, setStatus] = createSignal('Loading the licensed cinema catalog…');
  const [catalogReady, setCatalogReady] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [playing, setPlaying] = createSignal(false);
  let video: HTMLVideoElement;
  let hls: import('hls.js').default;
  let disposed = false;
  let playbackGeneration = 0;
  let catalogRequest: AbortController;

  const destroyHls = () => {
    hls?.destroy();
    hls = undefined;
  };

  const playCurrent = async() => {
    try {
      await video.play();
      setStatus('Now playing.');
    } catch(error) {
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

    setCurrentIndex(index);
    setSection('cinema');
    setLoading(true);
    setPlaying(false);
    setStatus(`Loading ${item.title}…`);
    destroyHls();
    video.pause();
    video.removeAttribute('src');

    if(video.canPlayType(item.type)) {
      video.src = item.src;
      video.load();
      setLoading(false);
      setStatus(`Ready: ${item.title}.`);
      if(autoplay) void playCurrent();
      return;
    }

    if(item.type !== HLS_MIME_TYPE) {
      setLoading(false);
      setStatus('This browser cannot play the selected media format.');
      return;
    }

    try {
      const {default: Hls} = await import('hls.js');
      if(disposed || generation !== playbackGeneration) return;
      if(!Hls.isSupported()) {
        setLoading(false);
        setStatus('This browser does not support the selected stream format.');
        return;
      }

      hls = new Hls();
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if(disposed || generation !== playbackGeneration) return;
        setLoading(false);
        setStatus(`Ready: ${item.title}.`);
        if(autoplay) void playCurrent();
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if(data.fatal && !disposed && generation === playbackGeneration) {
          console.error('Cinema HLS playback failed.', data);
          destroyHls();
          setLoading(false);
          setStatus('This stream could not be loaded. Check the media provider and try again.');
        }
      });
      hls.loadSource(item.src);
      hls.attachMedia(video);
    } catch(error) {
      if(disposed || generation !== playbackGeneration) return;
      console.error('Could not initialize HLS playback.', error);
      setLoading(false);
      setStatus('The stream player could not be initialized.');
    }
  };

  const loadLiveStream = async() => {
    const generation = ++playbackGeneration;
    setSection('live');
    setCurrentIndex(-1);
    setLoading(true);
    setPlaying(false);
    setStatus('Connecting to Al Jazeera English live…');
    destroyHls();
    video.pause();
    video.removeAttribute('src');

    if(video.canPlayType(HLS_MIME_TYPE)) {
      video.src = LIVE_STREAM_URL;
      video.load();
      setLoading(false);
      void playCurrent();
      return;
    }

    try {
      const {default: Hls} = await import('hls.js');
      if(disposed || generation !== playbackGeneration) return;
      if(!Hls.isSupported()) {
        setLoading(false);
        setStatus('Live HLS playback is not supported in this browser.');
        return;
      }

      hls = new Hls();
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if(disposed || generation !== playbackGeneration) return;
        setLoading(false);
        void playCurrent();
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if(data.fatal && !disposed && generation === playbackGeneration) {
          console.error('Al Jazeera English live stream failed.', data);
          destroyHls();
          setLoading(false);
          setStatus('The live feed is unavailable here. Open Al Jazeera’s official live page.');
        }
      });
      hls.loadSource(LIVE_STREAM_URL);
      hls.attachMedia(video);
    } catch(error) {
      if(disposed || generation !== playbackGeneration) return;
      console.error('Could not initialize the live HLS stream.', error);
      setLoading(false);
      setStatus('The live player could not be initialized.');
    }
  };

  const loadCatalog = async() => {
    catalogRequest = new AbortController();
    try {
      const response = await fetch('/api/cinema-catalog', {
        headers: {Accept: 'application/json'},
        signal: catalogRequest.signal
      });
      const result: unknown = await response.json();
      if(!response.ok) {
        if(response.status !== 503) console.error('Cinema catalog request failed.', response.status, result);
        setStatus(response.status === 503 ?
          'Licensed episodes are not configured yet. The live channel is available below.' :
          'The cinema catalog could not be loaded. Please try again later.');
        return;
      }

      if(!result || typeof result !== 'object' || !('items' in result) ||
        !Array.isArray(result.items) || !result.items.every(isCinemaItem)) {
        throw new Error('Cinema catalog response has no items array.');
      }

      setItems(result.items);
      setCatalogReady(true);
      setStatus(result.items.length ?
        `${result.items.length} licensed episodes ready to play.` :
        'No licensed episodes are available in the catalog yet.');
    } catch(error) {
      if(error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Cinema catalog could not be loaded.', error);
      setStatus('The cinema catalog could not be loaded. Please try again later.');
    }
  };

  const advanceQueue = () => {
    const nextIndex = currentIndex() + 1;
    if(nextIndex < 0 || nextIndex >= items().length) {
      setPlaying(false);
      setStatus('You reached the end of the available playlist.');
      return;
    }
    void loadItem(nextIndex);
  };

  const selectSection = (nextSection: CinemaSection) => {
    if(nextSection === 'live') {
      void loadLiveStream();
      return;
    }
    if(nextSection === 'cinema') {
      if(section() === 'cinema') return;
      if(items().length) void loadItem(currentIndex() > -1 ? currentIndex() : 0);
      else setSection('cinema');
      return;
    }
    ++playbackGeneration;
    destroyHls();
    video.pause();
    video.removeAttribute('src');
    video.load();
    setCurrentIndex(-1);
    setPlaying(false);
    setSection('rewards');
    setStatus('Earnings are unavailable until a verified rewards service is configured.');
  };

  onMount(() => {
    const webApp = (window as Window & {
      Telegram?: {
        WebApp?: {
          ready?: () => void,
          expand?: () => void
        }
      }
    }).Telegram?.WebApp;
    webApp?.ready?.();
    webApp?.expand?.();
    void loadCatalog();

    onCleanup(() => {
      disposed = true;
      ++playbackGeneration;
      catalogRequest?.abort();
      destroyHls();
      video.pause();
      video.removeAttribute('src');
      video.load();
    });
  });

  return (
    <EmbeddedBrowserEngine activeSection={section()} onSectionChange={selectSection}>
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
          </Switch>
        </div>

        <div class="cinema-grid" hidden={section() === 'rewards'}>
          <div class="cinema-main-column">
            <div class="cinema-player" classList={{'cinema-live-player': section() === 'live'}}>
              <video
                ref={video}
                controls
                playsinline
                preload="auto"
                aria-label={section() === 'live' ? 'Al Jazeera English live stream' : 'Cinema video player'}
                onPlay={() => {
                  setPlaying(true);
                  setStatus('Now playing.');
                }}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                  if(section() === 'cinema') advanceQueue();
                }}
                onError={(event) => {
                  if(!event.currentTarget.error || disposed) return;
                  console.error('Cinema media playback failed.', event.currentTarget.error);
                  setLoading(false);
                  setStatus(section() === 'live' ?
                    'The live feed is unavailable in this browser or region.' :
                    'This title could not be played. Check its licensed provider source.');
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
                    <p>{status()}</p>
                  </div>
                  <div class="cinema-player-actions">
                    <button
                      class="cinema-control"
                      type="button"
                      disabled={!catalogReady() || !items().length || loading()}
                      onClick={() => currentIndex() > -1 ? void loadItem(currentIndex()) : void loadItem(0)}
                    >
                      {playing() ? 'Restart title' : 'Play title'}
                    </button>
                    <button
                      class="cinema-control cinema-control-subtle"
                      type="button"
                      disabled={!items().length || currentIndex() < 0 || currentIndex() + 1 >= items().length}
                      onClick={advanceQueue}
                    >
                      Next title
                    </button>
                  </div>
                </div>
                <p class="cinema-audio-note">Playback may require a tap in embedded browsers. Use the player controls to adjust volume.</p>
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
                        onClick={() => void loadItem(index())}
                      >
                        <span class="cinema-queue-index">{(index() + 1).toString().padStart(2, '0')}</span>
                        <span class="cinema-queue-copy">
                          <strong>{item.title}</strong>
                          <small>{item.series} · S{item.season} · E{item.episode}</small>
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

        <Show when={section() === 'rewards'}>
          <section class="cinema-rewards-card" aria-labelledby="rewards-title">
            <span class="cinema-rewards-icon" aria-hidden="true">◇</span>
            <h2 id="rewards-title">Verified earnings are not available yet</h2>
            <p>Viewing time stored in this browser is not proof of a completed task, and it cannot authorize a blockchain payout. A verified account, persistent rewards ledger and payout service must be configured before earnings can be enabled.</p>
            <a href="https://ton.org/wallets" target="_blank" rel="noopener noreferrer">Explore TON wallets <span aria-hidden="true">↗</span></a>
          </section>
        </Show>
      </section>
    </EmbeddedBrowserEngine>
  );
}

const root = document.getElementById('cinema-root');
if(!root) throw new Error('Cinema page root element was not found.');

render(() => <CinemaPage />, root);
