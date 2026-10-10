import {getNextPlayableIndex} from '@/cinemaQueue';

describe('cinema playlist rotation', () => {
  it('advances to the next item and wraps at the end', () => {
    const unavailable = new Set<number>();

    expect(getNextPlayableIndex(0, 3, unavailable)).toBe(1);
    expect(getNextPlayableIndex(2, 3, unavailable)).toBe(0);
  });

  it('skips sources that have already failed', () => {
    expect(getNextPlayableIndex(0, 4, new Set([1, 2]))).toBe(3);
  });

  it('returns no item when every configured source has failed', () => {
    expect(getNextPlayableIndex(1, 2, new Set([0, 1]))).toBe(-1);
    expect(getNextPlayableIndex(-1, 0, new Set())).toBe(-1);
  });
});
