import {JSX} from 'solid-js';

export type CinemaSection = 'cinema' | 'live' | 'rewards';

export default function EmbeddedBrowserEngine(props: {
  activeSection: CinemaSection,
  onSectionChange: (section: CinemaSection) => void,
  children: JSX.Element
}) {
  const telegramWebApp = (window as Window & {
    Telegram?: {
      WebApp?: unknown
    }
  }).Telegram?.WebApp;

  return (
    <main class="cinema-shell">
      <header class="cinema-topbar">
        <a class="cinema-brand" href="/cinema" aria-label="Urban Cinema home">
          <span class="cinema-brand-mark" aria-hidden="true">U</span>
          <span>
            <strong>URBAN CINEMA</strong>
            <small>WATCH · DISCOVER · ENJOY</small>
          </span>
        </a>
        <nav class="cinema-nav" aria-label="Main navigation">
          <button
            type="button"
            class="cinema-nav-item"
            classList={{'is-active': props.activeSection === 'cinema'}}
            aria-current={props.activeSection === 'cinema' ? 'page' : undefined}
            onClick={() => props.onSectionChange('cinema')}
          >
            Cinema
          </button>
          <button
            type="button"
            class="cinema-nav-item"
            classList={{'is-active': props.activeSection === 'live'}}
            aria-current={props.activeSection === 'live' ? 'page' : undefined}
            onClick={() => props.onSectionChange('live')}
          >
            Live
          </button>
          <button
            type="button"
            class="cinema-nav-item"
            classList={{'is-active': props.activeSection === 'rewards'}}
            aria-current={props.activeSection === 'rewards' ? 'page' : undefined}
            onClick={() => props.onSectionChange('rewards')}
          >
            Rewards
          </button>
        </nav>
        <span class="cinema-context">
          <span class="cinema-context-dot" aria-hidden="true"></span>
          {telegramWebApp ? 'TELEGRAM MINI APP' : 'WEB APP'}
        </span>
      </header>
      {props.children}
      <footer class="cinema-bottom-bar">
        <span>URBAN CINEMA</span>
        <span>Media availability depends on your region and provider.</span>
      </footer>
    </main>
  );
}
