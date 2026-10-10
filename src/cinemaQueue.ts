import type {CinemaItem} from '@/cinemaCatalog';

export function getNextPlayableIndex(currentIndex: number, itemCount: number, unavailable: ReadonlySet<number>) {
  if(itemCount <= 0) return -1;

  for(let offset = 1; offset <= itemCount; offset++) {
    const index = (currentIndex + offset + itemCount) % itemCount;
    if(!unavailable.has(index)) return index;
  }

  return -1;
}

// Get the next episode in the same series, or first episode of next series
export function getNextEpisodeInSeries(
  currentIndex: number,
  items: CinemaItem[],
  unavailable: ReadonlySet<number>
): number {
  if(currentIndex < 0 || currentIndex >= items.length) return -1;
  
  const currentItem = items[currentIndex];
  const currentSeries = currentItem.series;
  
  // Find next episode in the same series
  for(let i = currentIndex + 1; i < items.length; i++) {
    if(!unavailable.has(i) && items[i].series === currentSeries) {
      return i;
    }
  }
  
  // If no more episodes in current series, find first episode of next series
  for(let i = currentIndex + 1; i < items.length; i++) {
    if(!unavailable.has(i) && items[i].series !== currentSeries) {
      return i;
    }
  }
  
  return -1;
}

// Get the previous episode in the same series, or last episode of previous series
export function getPreviousEpisodeInSeries(
  currentIndex: number,
  items: CinemaItem[],
  unavailable: ReadonlySet<number>
): number {
  if(currentIndex < 0 || currentIndex >= items.length) return -1;
  
  const currentItem = items[currentIndex];
  const currentSeries = currentItem.series;
  
  // Find previous episode in the same series
  for(let i = currentIndex - 1; i >= 0; i--) {
    if(!unavailable.has(i) && items[i].series === currentSeries) {
      return i;
    }
  }
  
  // If no more episodes in current series, find last episode of previous series
  for(let i = currentIndex - 1; i >= 0; i--) {
    if(!unavailable.has(i) && items[i].series !== currentSeries) {
      return i;
    }
  }
  
  return -1;
}
