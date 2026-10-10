export function getNextPlayableIndex(currentIndex: number, itemCount: number, unavailable: ReadonlySet<number>) {
  if(itemCount <= 0) return -1;

  for(let offset = 1; offset <= itemCount; offset++) {
    const index = (currentIndex + offset + itemCount) % itemCount;
    if(!unavailable.has(index)) return index;
  }

  return -1;
}
