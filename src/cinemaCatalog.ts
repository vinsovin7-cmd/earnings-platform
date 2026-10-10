export const HLS_MIME_TYPE = 'application/vnd.apple.mpegurl';

export type CinemaItem = {
  id: string,
  title: string,
  series: string,
  season: number,
  episode: number,
  src: string,
  type: string,
  poster?: string,
  description?: string,
  year?: number
};

// Merlin Seasons 1-5
export const MERLIN_SEASON_1: CinemaItem = {
  id: 'merlin-s01',
  title: 'Merlin — Season 1',
  series: 'Merlin',
  season: 1,
  episode: 1,
  src: 'https://storage.googleapis.com/urban-cinema-assets/merlin/season1.m3u8',
  type: HLS_MIME_TYPE,
  poster: 'https://storage.googleapis.com/urban-cinema-assets/merlin/s01-poster.jpg',
  description: 'The adventure begins as Merlin arrives in Camelot.',
  year: 2008
};

export const MERLIN_SEASON_2: CinemaItem = {
  id: 'merlin-s02',
  title: 'Merlin — Season 2',
  series: 'Merlin',
  season: 2,
  episode: 1,
  src: 'https://storage.googleapis.com/urban-cinema-assets/merlin/season2.m3u8',
  type: HLS_MIME_TYPE,
  poster: 'https://storage.googleapis.com/urban-cinema-assets/merlin/s02-poster.jpg',
  description: 'Merlin faces greater challenges and darker magic.',
  year: 2009
};

export const MERLIN_SEASON_3: CinemaItem = {
  id: 'merlin-s03',
  title: 'Merlin — Season 3',
  series: 'Merlin',
  season: 3,
  episode: 1,
  src: 'https://storage.googleapis.com/urban-cinema-assets/merlin/season3.m3u8',
  type: HLS_MIME_TYPE,
  poster: 'https://storage.googleapis.com/urban-cinema-assets/merlin/s03-poster.jpg',
  description: 'Morgana returns with a vengeance.',
  year: 2010
};

export const MERLIN_SEASON_4: CinemaItem = {
  id: 'merlin-s04',
  title: 'Merlin — Season 4',
  series: 'Merlin',
  season: 4,
  episode: 1,
  src: 'https://storage.googleapis.com/urban-cinema-assets/merlin/season4.m3u8',
  type: HLS_MIME_TYPE,
  poster: 'https://storage.googleapis.com/urban-cinema-assets/merlin/s04-poster.jpg',
  description: 'The quest for Excalibur begins.',
  year: 2011
};

export const MERLIN_SEASON_5: CinemaItem = {
  id: 'merlin-s05',
  title: 'Merlin — Season 5',
  series: 'Merlin',
  season: 5,
  episode: 1,
  src: 'https://storage.googleapis.com/urban-cinema-assets/merlin/season5.m3u8',
  type: HLS_MIME_TYPE,
  poster: 'https://storage.googleapis.com/urban-cinema-assets/merlin/s05-poster.jpg',
  description: 'The destiny of Camelot is revealed.',
  year: 2012
};

// Legend of the Seeker Seasons 1-2
export const LEGEND_SEASON_1: CinemaItem = {
  id: 'legend-s01',
  title: 'Legend of the Seeker — Season 1',
  series: 'Legend of the Seeker',
  season: 1,
  episode: 1,
  src: 'https://storage.googleapis.com/urban-cinema-assets/legend/season1.m3u8',
  type: HLS_MIME_TYPE,
  poster: 'https://storage.googleapis.com/urban-cinema-assets/legend/s01-poster.jpg',
  description: 'Richard Cypher begins his journey as the Seeker of Truth.',
  year: 2008
};

export const LEGEND_SEASON_2: CinemaItem = {
  id: 'legend-s02',
  title: 'Legend of the Seeker — Season 2',
  series: 'Legend of the Seeker',
  season: 2,
  episode: 1,
  src: 'https://storage.googleapis.com/urban-cinema-assets/legend/season2.m3u8',
  type: HLS_MIME_TYPE,
  poster: 'https://storage.googleapis.com/urban-cinema-assets/legend/s02-poster.jpg',
  description: 'The battle against Darken Rahl intensifies.',
  year: 2009
};

// Fallback demo item (kept for backward compatibility)
export const DEMO_CINEMA_ITEM: CinemaItem = {
  id: 'mdn-flower-demo',
  title: 'MDN Flower Video — Demo Preview',
  series: 'MDN CC0 sample',
  season: 0,
  episode: 0,
  src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  type: 'video/mp4'
};

// Full catalog with proper ordering: Merlin S1-5, then Legend S1-2
export const FULL_CINEMA_CATALOG: CinemaItem[] = [
  MERLIN_SEASON_1,
  MERLIN_SEASON_2,
  MERLIN_SEASON_3,
  MERLIN_SEASON_4,
  MERLIN_SEASON_5,
  LEGEND_SEASON_1,
  LEGEND_SEASON_2
];

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

export function shouldAutoLoadInitialCatalog(
  initialLoadPending: boolean,
  section: string,
  currentIndex: number,
  itemCount: number
) {
  return initialLoadPending && section === 'cinema' && currentIndex === -1 && itemCount > 0;
}

// Get the next item in the queue for automatic progression
export function getNextItemInQueue(currentItem: CinemaItem | null, allItems: CinemaItem[]): CinemaItem | null {
  if(!currentItem || !allItems.length) return null;
  
  const currentIndex = allItems.findIndex(item => item.id === currentItem.id);
  if(currentIndex === -1) return null;
  
  const nextIndex = currentIndex + 1;
  if(nextIndex >= allItems.length) return null;
  
  return allItems[nextIndex];
}

// Get the previous item in the queue
export function getPreviousItemInQueue(currentItem: CinemaItem | null, allItems: CinemaItem[]): CinemaItem | null {
  if(!currentItem || !allItems.length) return null;
  
  const currentIndex = allItems.findIndex(item => item.id === currentItem.id);
  if(currentIndex === -1) return null;
  
  const previousIndex = currentIndex - 1;
  if(previousIndex < 0) return null;
  
  return allItems[previousIndex];
}

// Check if an item is part of a series
export function isPartOfSeries(item: CinemaItem, seriesName: string): boolean {
  return item.series.toLowerCase() === seriesName.toLowerCase();
}

// Get all items in a series
export function getSeriesItems(allItems: CinemaItem[], seriesName: string): CinemaItem[] {
  return allItems.filter(item => isPartOfSeries(item, seriesName));
}

// Get the catalog to use (try full catalog first, then fallback)
export function getInitialCatalog(): CinemaItem[] {
  return [...FULL_CINEMA_CATALOG];
}

export function shouldRetryCatalogAutomatically(attempt: number, failure: 'network' | 'timeout' | 'response') {
  return attempt === 0 && (failure === 'network' || failure === 'timeout');
}
