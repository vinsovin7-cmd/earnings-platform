export const HLS_MIME_TYPE = 'application/vnd.apple.mpegurl';

export type CinemaItem = {
  id: string,
  title: string,
  series: string,
  season: number,
  episode: number,
  src: string,
  type: string
};

export const DEMO_CINEMA_ITEM: CinemaItem = {
  id: 'mdn-flower-demo',
  title: 'MDN Flower Video — Demo Preview',
  series: 'MDN CC0 sample',
  season: 0,
  episode: 0,
  src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  type: 'video/mp4'
};

export type CatalogResult =
  | {kind: 'configured', items: CinemaItem[]}
  | {kind: 'fallback'}
  | {kind: 'aborted'};

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

export function getCatalogResponseResult(responseOk: boolean, payload: unknown): CatalogResult {
  if(!responseOk || !payload || typeof payload !== 'object' || !('items' in payload) ||
    !Array.isArray(payload.items) || !payload.items.every(isCinemaItem)) {
    return {kind: 'fallback'};
  }

  return {kind: 'configured', items: payload.items};
}

export function getCatalogFailureResult(signalAborted: boolean, timedOut: boolean): CatalogResult {
  if(signalAborted && !timedOut) return {kind: 'aborted'};
  return {kind: 'fallback'};
}

export function getDemoRetryIndex(fallbackActive: boolean, fallbackError: boolean, currentIndex: number) {
  return fallbackActive && fallbackError && currentIndex >= 0 ? currentIndex : -1;
}
