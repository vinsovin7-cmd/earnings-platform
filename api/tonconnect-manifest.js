function createTonConnectManifest(origin) {
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

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  if(req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({error: 'Method not allowed.'});
    return;
  }

  const [path] = (req.url || '').split('?');
  const isWellKnown = path === '/.well-known/tonconnect-manifest.json';

  // TON Connect standard well-known path does not require an origin query param;
  // derive the origin from the request host instead.
  if(isWellKnown) {
    const forwardedProtocol = req.headers['x-forwarded-proto'];
    const host = req.headers.host;
    const protocol = Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol;
    if(typeof protocol !== 'string' || typeof host !== 'string') {
      res.status(400).json({error: 'A valid origin is required.'});
      return;
    }
    try {
      const origin = `${protocol.split(',')[0].trim()}://${host}`;
      res.status(200).json(createTonConnectManifest(origin));
    } catch{
      res.status(400).json({error: 'A valid HTTPS origin is required.'});
    }
    return;
  }

  const forwardedProtocol = req.headers['x-forwarded-proto'];
  const host = req.headers.host;
  const protocol = Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol;
  if(typeof protocol !== 'string' || typeof host !== 'string') {
    res.status(400).json({error: 'A valid HTTPS request origin is required.'});
    return;
  }

  try {
    const origin = `${protocol.split(',')[0].trim()}://${host}`;
    res.status(200).json(createTonConnectManifest(origin));
  } catch{
    res.status(400).json({error: 'A valid HTTPS request origin is required.'});
  }
};