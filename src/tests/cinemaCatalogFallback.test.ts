import {DEMO_CINEMA_ITEM, getCatalogFailureResult, getCatalogResponseResult, getDemoRetryIndex, shouldAutoLoadInitialCatalog, shouldRetryCatalogAutomatically} from '@/cinemaCatalog';

describe('cinema catalog fallback', () => {
  it('keeps a valid configured catalog, including an empty one', () => {
    const item = {
      id: 'episode-1',
      title: 'Episode 1',
      series: 'Example',
      season: 1,
      episode: 1,
      src: 'https://media.example.com/episode.mp4',
      type: 'video/mp4'
    };

    expect(getCatalogResponseResult(true, {items: [item]})).toEqual({kind: 'configured', items: [item]});
    expect(getCatalogResponseResult(true, {items: []})).toEqual({kind: 'configured', items: []});
  });

  it('selects the MDN CC0 demo only for failed or invalid catalog responses', () => {
    expect(getCatalogResponseResult(false, {items: []})).toEqual({kind: 'fallback'});
    expect(getCatalogResponseResult(true, {items: [{id: 'invalid'}]})).toEqual({kind: 'fallback'});
    expect(DEMO_CINEMA_ITEM.src).toBe('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4');
  });

  it('distinguishes an intentional abort from a request timeout', () => {
    expect(getCatalogFailureResult(true, false)).toEqual({kind: 'aborted'});
    expect(getCatalogFailureResult(true, true)).toEqual({kind: 'fallback'});
    expect(getCatalogFailureResult(false, false)).toEqual({kind: 'fallback'});
  });

  it('allows retrying only a failed demo fallback at its current index', () => {
    expect(getDemoRetryIndex(true, true, 0)).toBe(0);
    expect(getDemoRetryIndex(true, false, 0)).toBe(-1);
    expect(getDemoRetryIndex(false, true, 0)).toBe(-1);
    expect(getDemoRetryIndex(true, true, -1)).toBe(-1);
  });

  it('auto-loads only the first item while initial cinema selection is still untouched', () => {
    expect(shouldAutoLoadInitialCatalog(true, 'cinema', -1, 2)).toBe(true);
    expect(shouldAutoLoadInitialCatalog(true, 'live', -1, 2)).toBe(false);
    expect(shouldAutoLoadInitialCatalog(true, 'cinema', 0, 2)).toBe(false);
    expect(shouldAutoLoadInitialCatalog(false, 'cinema', -1, 2)).toBe(false);
    expect(shouldAutoLoadInitialCatalog(true, 'cinema', -1, 0)).toBe(false);
  });

  it('permits one delayed catalog retry only for a network failure or timeout', () => {
    expect(shouldRetryCatalogAutomatically(0, 'network')).toBe(true);
    expect(shouldRetryCatalogAutomatically(0, 'timeout')).toBe(true);
    expect(shouldRetryCatalogAutomatically(0, 'response')).toBe(false);
    expect(shouldRetryCatalogAutomatically(1, 'network')).toBe(false);
  });
});
