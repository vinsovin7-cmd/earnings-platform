export type PlaybackIdentity = {
  id: string,
  season: number,
  episode: number
};

export function getPlaybackStorageKey(identity: PlaybackIdentity) {
  return `urban-cinema-playback:${encodeURIComponent(identity.id)}:s${identity.season}:e${identity.episode}`;
}

export function parsePlaybackPosition(value: string | null) {
  if(value === null) return 0;
  const position = Number(value);
  return Number.isFinite(position) && position >= 0 ? position : 0;
}
