export type TonConnectManifest = {
  url: string,
  name: string,
  iconUrl: string
};

export function createTonConnectManifest(origin: string): TonConnectManifest {
  const parsedOrigin = new URL(origin);
  if(parsedOrigin.protocol !== 'https:' || parsedOrigin.origin !== origin) {
    throw new Error('A valid HTTPS origin is required.');
  }

  return {
    url: origin,
    name: 'Urban Cinema',
    iconUrl: new URL('/assets/img/logo.svg', origin).href
  };
}
