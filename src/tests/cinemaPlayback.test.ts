import {getPlaybackStorageKey, parsePlaybackPosition} from '@/cinemaPlayback';

describe('cinema playback persistence', () => {
  it('keys playback by media id, season, and episode', () => {
    expect(getPlaybackStorageKey({id: 'series/one', season: 2, episode: 8}))
      .toBe('urban-cinema-playback:series%2Fone:s2:e8');
  });

  it('parses only finite non-negative resume positions', () => {
    expect(parsePlaybackPosition('48.25')).toBe(48.25);
    expect(parsePlaybackPosition(null)).toBe(0);
    expect(parsePlaybackPosition('-5')).toBe(0);
    expect(parsePlaybackPosition('Infinity')).toBe(0);
  });
});
