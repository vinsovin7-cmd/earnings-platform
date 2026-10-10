import {JSX, createEffect, onCleanup, onMount} from 'solid-js';

export type CinemaSection = 'cinema' | 'live' | 'rewards' | 'shop' | 'companion';

type TelegramThemeParams = {
  bg_color?: string,
  text_color?: string,
  hint_color?: string,
  link_color?: string,
  button_color?: string,
  button_text_color?: string,
  secondary_bg_color?: string
};

type TelegramInitData = {
  query_id?: string,
  user?: {
    id: number,
    first_name?: string,
    last_name?: string,
    username?: string,
    language_code?: string
  },
  chat?: {
    id: number,
    type: string,
    title?: string
  },
  hash: string
};

type TelegramWebApp = {
  ready: () => void,
  expand: () => void,
  sendData: (data: string) => void,
  close: () => void,
  themeParams: TelegramThemeParams,
  initData: string,
  initDataUnsafe: TelegramInitData,
  isExpanded: boolean
};

export default function EmbeddedBrowserEngine(props: {
  activeSection: CinemaSection,
  onSectionChange: (section: CinemaSection) => void,
  headerStatus?: JSX.Element,
  children: JSX.Element
}) {
  let mainElement: HTMLDivElement;

  onMount(() => {
    const webApp = (window as Window & {Telegram?: {WebApp?: TelegramWebApp}}).Telegram?.WebApp;
    if(webApp) {
      webApp.ready();
      webApp.expand();

      applyTelegramTheme(webApp.themeParams);

      const themeObserver = new MutationObserver(() => {
        applyTelegramTheme(webApp.themeParams);
      });
      themeObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['data-tgme-w']});

      onCleanup(() => themeObserver.disconnect());
    }

    // Handle direct URL routing for standalone cinema access
    const handleDirectRouting = () => {
      // Check URL hash for section navigation
      const hash = window.location.hash.slice(1); // Remove leading #
      if(hash && ['cinema', 'live', 'rewards', 'shop', 'companion'].includes(hash)) {
        props.onSectionChange(hash as CinemaSection);
        return;
      }

      // Check path for direct cinema access
      const path = window.location.pathname;
      if(path === '/cinema' || path === '/cinema.html' || path.startsWith('/cinema/')) {
        props.onSectionChange('cinema');
        return;
      }

      // Check for section in path
      const pathSection = path.split('/')[1];
      if(['cinema', 'live', 'rewards', 'shop', 'companion'].includes(pathSection)) {
        props.onSectionChange(pathSection as CinemaSection);
      }
    };

    // Initial routing check
    handleDirectRouting();

    // Listen for hash changes
    window.addEventListener('hashchange', handleDirectRouting);

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', handleDirectRouting);

    onCleanup(() => {
      window.removeEventListener('hashchange', handleDirectRouting);
      window.removeEventListener('popstate', handleDirectRouting);
    });
  });

  const applyTelegramTheme = (themeParams: TelegramThemeParams) => {
    if(!mainElement) return;

    const root = mainElement.closest(':root') || document.documentElement;

    if(themeParams.bg_color) {
      root.style.setProperty('--tgme-bg-color', themeParams.bg_color);
      root.style.setProperty('--tgme-secondary-bg-color', themeParams.secondary_bg_color || themeParams.bg_color);
    }
    if(themeParams.text_color) {
      root.style.setProperty('--tgme-text-color', themeParams.text_color);
    }
    if(themeParams.hint_color) {
      root.style.setProperty('--tgme-hint-color', themeParams.hint_color);
    }
    if(themeParams.link_color) {
      root.style.setProperty('--tgme-link-color', themeParams.link_color);
    }
    if(themeParams.button_color) {
      root.style.setProperty('--tgme-button-color', themeParams.button_color);
    }
    if(themeParams.button_text_color) {
      root.style.setProperty('--tgme-button-text-color', themeParams.button_text_color);
    }
  };

  const getTelegramContext = () => {
    const webApp = (window as Window & {Telegram?: {WebApp?: TelegramWebApp}}).Telegram?.WebApp;
    if(webApp?.initDataUnsafe?.user) {
      const user = webApp.initDataUnsafe.user;
      return `Telegram · ${user.first_name || 'User'}${user.last_name ? ' ' + user.last_name : ''}`;
    }
    return webApp ? 'TELEGRAM MINI APP' : 'WEB APP';
  };

  return (
    <main class="cinema-shell" ref={mainElement} data-telegram-webapp={!!(window as Window & {Telegram?: {WebApp?: unknown}}).Telegram?.WebApp}>
      <header class="cinema-topbar">
        <a class="cinema-brand" href="#cinema" aria-label="Urban Cinema home" onClick={(e) => {
          e.preventDefault();
          props.onSectionChange('cinema');
          window.history.pushState({}, '', '#cinema');
        }}>
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
            onClick={() => {
              props.onSectionChange('cinema');
              window.history.pushState({}, '', '#cinema');
            }}
          >
            Cinema
          </button>
          <button
            type="button"
            class="cinema-nav-item"
            classList={{'is-active': props.activeSection === 'live'}}
            aria-current={props.activeSection === 'live' ? 'page' : undefined}
            onClick={() => {
              props.onSectionChange('live');
              window.history.pushState({}, '', '#live');
            }}
          >
            Live
          </button>
          <button
            type="button"
            class="cinema-nav-item"
            classList={{'is-active': props.activeSection === 'rewards'}}
            aria-current={props.activeSection === 'rewards' ? 'page' : undefined}
            onClick={() => {
              props.onSectionChange('rewards');
              window.history.pushState({}, '', '#rewards');
            }}
          >
            Rewards
          </button>
          <button
            type="button"
            class="cinema-nav-item"
            classList={{'is-active': props.activeSection === 'shop'}}
            aria-current={props.activeSection === 'shop' ? 'page' : undefined}
            onClick={() => {
              props.onSectionChange('shop');
              window.history.pushState({}, '', '#shop');
            }}
          >
            SreyShop
          </button>
        </nav>
        <div class="cinema-context">
          <span class="cinema-context-dot" aria-hidden="true"></span>
          {getTelegramContext()}
          {props.headerStatus}
        </div>
      </header>
      {props.children}
      <footer class="cinema-bottom-bar">
        <span>URBAN CINEMA</span>
        <span>Media availability depends on your region and provider.</span>
      </footer>
    </main>
  );
}
